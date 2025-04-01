"use client";
import { useState, useEffect, useRef } from "react";
import {
  FilesetResolver,
  PoseLandmarker,
  DrawingUtils,
} from "@mediapipe/tasks-vision";

const VideoTracking = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [poseLandmarker, setPoseLandmarker] = useState<
    PoseLandmarker | undefined
  >(undefined);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number>(performance.now());
  const [detectedKeypoints, setDetectedKeypoints] = useState<any[]>([]);

  // const videoWidth = 720;
  // const videoHeight = 480;

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
        // minPoseDetectionConfidence: 0.3,
        // minTrackingConfidence: 0.3,
      });
      console.log("PoseLandmarker initialized successfully");
      setPoseLandmarker(landmarker);
    } catch (err: any) {
      console.error("Error initializing PoseLandmarker:", err);
      setError(`Failed to initialize PoseLandmarker: ${err.message}`);
    }
  };

  useEffect(() => {
    createPoseLandmarker();

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  const handleVideoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!poseLandmarker) {
      console.log("Wait! PoseLandmarker not loaded yet.");
      setError("PoseLandmarker not loaded yet.");
      return;
    }

    console.log("Uploading video:", file.name);

    if (videoRef.current) {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }

      const videoUrl = URL.createObjectURL(file);
      videoRef.current.src = videoUrl;
      console.log("Video source set to:", videoRef.current.src);
      setVideoPlaying(true);
      setDetectedKeypoints([]);

      let frame_id = 0; // Initialize frame_id

      videoRef.current.onloadeddata = () => {
        console.log(
          "Video file loaded, starting playback, duration:",
          videoRef.current?.duration,
          "resolution:",
          videoRef.current?.videoWidth,
          videoRef.current?.videoHeight
        );

        // Resize the video to a maximum width of 720px while maintaining aspect ratio
        const aspectRatio =
          videoRef.current!.videoWidth / videoRef.current!.videoHeight;
        const maxWidth = 720;
        let newWidth = videoRef.current!.videoWidth;
        let newHeight = videoRef.current!.videoHeight;

        if (newWidth > maxWidth) {
          newWidth = maxWidth;
          newHeight = maxWidth / aspectRatio;
        }

        videoRef.current!.width = newWidth;
        videoRef.current!.height = newHeight;

        console.log("Video dimensions:", {
          videoWidth: videoRef.current!.width,
          videoHeight: videoRef.current!.height,
        });

        // Dynamically set canvas dimensions
        if (canvasRef.current) {
          canvasRef.current.width = videoRef.current!.width;
          canvasRef.current.height = videoRef.current!.height;
        }

        videoRef
          .current!.play()
          .then(() => {
            console.log("Video playback started, videoPlaying:", videoPlaying);

            // // Delay prediction to ensure frame is rendered
            // setTimeout(() => {
            if (poseLandmarker && videoRef.current && canvasRef.current) {
              predictVideo(frame_id);
            } else {
              console.error("Prediction cannot start:", {
                videoPlaying,
                poseLandmarker: !!poseLandmarker,
                videoRef: !!videoRef.current,
                canvasRef: !!canvasRef.current,
              });
              setError("Prediction cannot start due to missing components");
              setVideoPlaying(false);
            }
            // }, 10); // 100ms delay
          })
          .catch((err) => {
            console.error("Error playing video:", err);
            setError(`Failed to play video: ${err.message}`);
            setVideoPlaying(false);
          });
      };

      videoRef.current.onended = () => {
        console.log("Video ended, stopping prediction");
        setVideoPlaying(false);
        if (rafIdRef.current) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
        clearCanvas();
      };
    }
  };

  const clearCanvas = () => {
    if (canvasRef.current) {
      const canvasCtx = canvasRef.current.getContext("2d");
      if (canvasCtx) {
        canvasCtx.clearRect(
          0,
          0,
          canvasRef.current.width,
          canvasRef.current.height
        );
        console.log("Canvas cleared");
      }
    }
  };

  const predictVideo = (frame_id: number) => {
    if (!poseLandmarker || !videoRef.current || !canvasRef.current) {
      console.log("Prediction skipped:", {
        poseLandmarker: !!poseLandmarker,
        videoRef: !!videoRef.current,
        canvasRef: !!canvasRef.current,
        videoPlaying,
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
    // console.log(
    //   `Frame ${frame_id} processed at ${nowInMs.toFixed(
    //     2
    //   )}ms, FPS: ${fps.toFixed(2)}`
    // );

    poseLandmarker.detectForVideo(videoRef.current, nowInMs, (result) => {
      canvasCtx.save();
      canvasCtx.clearRect(
        0,
        0,
        canvasRef.current!.width,
        canvasRef.current!.height
      );

      let keypoints_data = {
        frame_id: frame_id,
        resolution: [
          videoRef.current!.videoWidth,
          videoRef.current!.videoHeight,
        ],
        video_timestamp: videoRef.current!.currentTime,
        fps: fps.toFixed(2),
        no_of_poses: result.landmarks.length,
        kpts:
          result.landmarks && result.landmarks.length > 0 && result.landmarks[0]
            ? result.landmarks[0].map((landmark, index) => ({
                frame_id: frame_id,
                kpt_id: index,
                normalzed_coords: [landmark.x, landmark.y],
                coords: [
                  landmark.x * videoRef.current!.videoWidth,
                  landmark.y * videoRef.current!.videoHeight,
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
          color: "#fff",
          lineWidth: 2,
        });
        drawingUtils.drawConnectors(landmark, PoseLandmarker.POSE_CONNECTIONS, {
          color: "#395EFC",
          lineWidth: 2,
        });
      }
      canvasCtx.restore();
    });

    rafIdRef.current = window.requestAnimationFrame(() =>
      predictVideo(frame_id + 1)
    );
  };

  return (
    <div className="flex flex-col justify-center items-center w-screen h-screen">
      <h1 className="text-3xl font-bold mb-5">MediaPipe Pose Tracking</h1>
      {error && <p className="text-red-500 mb-5">{error}</p>}
      <div
        id="demos"
        className="mt-5 flex flex-col items-center justify-center gap-4"
      >
        <div className="mb-4">
          <label htmlFor="videoUpload" className="mr-2 text-lg">
            Upload Video:
          </label>
          <input
            id="videoUpload"
            type="file"
            accept="video/*"
            onChange={handleVideoUpload}
            className="p-2 border rounded-md"
            disabled={videoPlaying}
          />
          {videoPlaying && (
            <button
              onClick={() => {
                if (videoRef.current) {
                  videoRef.current.pause();
                  setVideoPlaying(false);
                  if (rafIdRef.current) {
                    cancelAnimationFrame(rafIdRef.current);
                    rafIdRef.current = null;
                  }
                  clearCanvas();
                  setError(null);
                }
              }}
              className="ml-4 px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700"
            >
              Stop Video
            </button>
          )}
        </div>

        <div className="relative">
          <video
            ref={videoRef}
            // width={videoWidth}
            // height={videoHeight}
            playsInline
            className=""
          />
          <canvas
            ref={canvasRef}
            // width={videoWidth}
            // height={videoHeight}
            className="absolute top-0 left-0"
          />
        </div>
      </div>
    </div>
  );
};

export default VideoTracking;
