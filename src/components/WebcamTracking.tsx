"use client";
import { useState, useEffect, useRef } from "react";
import {
  FilesetResolver,
  PoseLandmarker,
  DrawingUtils,
} from "@mediapipe/tasks-vision";

const WebcamTracking = () => {
  const webcamRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [poseLandmarker, setPoseLandmarker] = useState<
    PoseLandmarker | undefined
  >(undefined);
  const [webcamRunning, setWebcamRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const rafIdRef = useRef<number | null>(null); // Track requestAnimationFrame ID
  const lastTimestampRef = useRef<number>(performance.now());
  const [detectedKeypoints, setDetectedKeypoints] = useState<any[]>([]);

  const webcamWidth = 720;
  const webcamHeight = 480;

  // Initialize PoseLandmarker and enumerate devices
  const createPoseLandmarker = async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
      );
      console.log("WASM files resolved successfully");

      const modelUrl =
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
      const landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: modelUrl,
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
        minTrackingConfidence: 0.5, // Lower threshold for tracking
      });
      console.log("PoseLandmarker initialized successfully");
      setPoseLandmarker(landmarker);
    } catch (err: any) {
      console.error("Error initializing PoseLandmarker:", err);
      setError(`Failed to initialize PoseLandmarker: ${err.message}`);
    }
  };

  const getDevices = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true });
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      const webcamDevices = deviceList.filter(
        (device) => device.kind === "videoinput"
      );
      setDevices(webcamDevices);
      if (webcamDevices.length > 0) {
        setSelectedDeviceId(webcamDevices[0].deviceId);
      }
    } catch (err: any) {
      console.error("Error enumerating devices:", err);
      setError(`Failed to enumerate devices: ${err.message}`);
    }
  };
  useEffect(() => {
    createPoseLandmarker();
    getDevices();

    // Cleanup on unmount
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      if (webcamRef.current && webcamRef.current.srcObject) {
        const tracks = (webcamRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach((track) => track.stop());
      }
    };
  }, []);

  // Handle webcam activation
  const enableCam = () => {
    if (!poseLandmarker) {
      console.log("Wait! PoseLandmarker not loaded yet.");
      setError("PoseLandmarker not loaded yet.");
      return;
    }

    if (webcamRunning) {
      console.log("Disabling webcam");
      setWebcamRunning(false);
      if (webcamRef.current && webcamRef.current.srcObject) {
        const tracks = (webcamRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach((track) => track.stop());
        webcamRef.current.srcObject = null;
      }
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      // Clear the canvas when disabling the webcam
      if (canvasRef.current) {
        const canvasCtx = canvasRef.current.getContext("2d");
        if (canvasCtx) {
          canvasCtx.clearRect(
            0,
            0,
            canvasRef.current.width,
            canvasRef.current.height
          );
          console.log("Canvas cleared on webcam disable");
        }
      }
      setError(null); // Clear any previous errors
    } else {
      console.log("Enabling webcam");
      setWebcamRunning(true);
      const constraints = {
        video: {
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
          width: { ideal: webcamWidth },
          height: { ideal: webcamHeight },
        },
      };
      navigator.mediaDevices
        .getUserMedia(constraints)
        .then((stream) => {
          if (webcamRef.current) {
            webcamRef.current.srcObject = stream;

            setDetectedKeypoints([]);
            let frame_id = 0; // Initialize frame_id

            webcamRef.current.onloadeddata = () => {
              console.log("webcam loaded, starting playback");
              webcamRef
                .current!.play()
                .then(() => {
                  console.log(
                    "webcam playback started, webcamRunning:",
                    webcamRunning
                  );
                  if (poseLandmarker && webcamRef.current && canvasRef.current) {
                    predictWebcam(frame_id); // Start prediction only when all components are ready
                  } else {
                    console.error("Prediction cannot start:", {
                      webcamRunning,
                      poseLandmarker: !!poseLandmarker,
                      webcamRef: !!webcamRef.current,
                      canvasRef: !!canvasRef.current,
                    });
                    setError(
                      "Prediction cannot start due to missing components"
                    );
                  }
                })
                .catch((err) => {
                  console.error("Error playing webcam:", err);
                  setError(`Failed to play webcam: ${err.message}`);
                  setWebcamRunning(false); // Only reset if play fails
                });
            };
          }
        })
        .catch((err) => {
          console.error("Error accessing webcam:", err);
          setError(`Webcam access failed: ${err.message}`);
          setWebcamRunning(false); // Only reset if getUserMedia fails
        });
    }
  };

  // Predict pose from webcam stream
  const predictWebcam = (frame_id: number) => {
    if (!poseLandmarker || !webcamRef.current || !canvasRef.current) {
      console.log("Prediction skipped:", {
        poseLandmarker: !!poseLandmarker,
        webcamRef: !!webcamRef.current,
        canvasRef: !!canvasRef.current,
        webcamRunning,
      });
      return;
    }

    const canvasCtx = canvasRef.current.getContext("2d");
    if (!canvasCtx) {
      console.error("Failed to get canvas context");
      setError("Failed to get canvas context");
      return;
    }

    const drawingUtils = new DrawingUtils(canvasCtx);
    const nowInMs = performance.now();

    // Calculate FPS
    const deltaTime = nowInMs - lastTimestampRef.current;
    const fps = 1000 / deltaTime;

    lastTimestampRef.current = nowInMs;

    // console.log("Predicting frame at time:", webcamRef.current.currentTime);

    poseLandmarker.detectForVideo(webcamRef.current, nowInMs, (result) => {
      canvasCtx.save();
      canvasCtx.clearRect(
        0,
        0,
        canvasRef.current!.width,
        canvasRef.current!.height
      );

      // console.log(
      //   "Detection result:",
      //   result.landmarks.length,
      //   "poses detected",
      //   result.landmarks.map((landmark) => landmark) // Log landmarks
      // );

      let keypoints_data = {
        frame_id: frame_id,
        resolution: [
          webcamRef.current!.videoWidth,
          webcamRef.current!.videoHeight,
        ],
        webcam_timestamp: webcamRef.current!.currentTime,
        fps: fps.toFixed(2),
        no_of_poses: result.landmarks.length,
        kpts:
          result.landmarks && result.landmarks.length > 0 && result.landmarks[0]
            ? result.landmarks[0].map((landmark, index) => ({
                frame_id: frame_id,
                kpt_id: index,
                normalzed_coords: [landmark.x, landmark.y],
                coords: [
                  landmark.x * webcamRef.current!.videoWidth,
                  landmark.y * webcamRef.current!.videoHeight,
                ],
              }))
            : [],
      };
      console.log(keypoints_data);
      setDetectedKeypoints((prev) => [...prev, keypoints_data]);

      if (result.landmarks.length === 0) {
        console.warn("No landmarks detected in this frame");
      }

      for (const landmark of result.landmarks) {
        drawingUtils.drawLandmarks(landmark, {
          radius: (data) => DrawingUtils.lerp(data.from!.z, -0.15, 0.1, 5, 1),
          color: "#fff", // Red for visibility
          lineWidth: 2,
        });
        drawingUtils.drawConnectors(landmark, PoseLandmarker.POSE_CONNECTIONS, {
          color: "#395EFC", // Green for visibility
          lineWidth: 2,
        });
      }
      canvasCtx.restore();
    });

    rafIdRef.current = window.requestAnimationFrame(() => predictWebcam(frame_id + 1));
  };

  return (
    <div className="flex flex-col justify-center items-center w-screen h-screen">
      <h1 className="text-3xl font-bold mb-5">MediaPipe Pose Tracking</h1>
      {error && <p className="text-red-500 mb-5">{error}</p>}
      <div
        id="demos"
        className="mt-5 flex flex-col items-center justify-center gap-2"
      >
        <div className="mb-4">
          <label htmlFor="webcamSelect" className="mr-2 text-lg">
            Select Webcam:
          </label>
          <select
            id="webcamSelect"
            value={selectedDeviceId}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
            className="p-2 border rounded-md"
            disabled={webcamRunning}
          >
            {devices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Webcam ${devices.indexOf(device) + 1}`}
              </option>
            ))}
          </select>
        </div>

        <button
          id="webcamButton"
          onClick={enableCam}
          className="mt-2.5 px-5 py-2.5 text-base text-white bg-blue-600 rounded-md hover:bg-blue-700 cursor-pointer border-none disabled:bg-gray-400 disabled:cursor-not-allowed"
          disabled={!poseLandmarker || !selectedDeviceId || !!error}
        >
          {webcamRunning ? "DISABLE PREDICTIONS" : "ENABLE PREDICTIONS"}
        </button>

        <div className="relative w-[720px] h-[480px]">
          <video
            ref={webcamRef}
            width={webcamWidth}
            height={webcamHeight}
            autoPlay
            playsInline
            className="absolute top-0 left-0"
          />
          <canvas
            ref={canvasRef}
            width={webcamWidth}
            height={webcamHeight}
            className="absolute top-0 left-0"
          />
        </div>
      </div>
    </div>
  );
};

export default WebcamTracking;
