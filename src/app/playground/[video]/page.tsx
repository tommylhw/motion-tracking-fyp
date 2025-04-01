"use client";
import React, { use, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  FilesetResolver,
  PoseLandmarker,
  DrawingUtils,
} from "@mediapipe/tasks-vision";
import { PulseLoader } from "react-spinners";
import Webcam from "react-webcam";

// ui
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// icons
import { FaPause, FaPlay, FaStop } from "react-icons/fa";
import { CiPlay1, CiPause1 } from "react-icons/ci";

const page = ({ params }: { params: Promise<{ video: string }> }) => {
  const router = useRouter();
  const { video } = use(params);
  const [decodedVideoUrl, setDecodedVideoUrl] = useState<string>(
    decodeURIComponent(video)
  );
  console.log("decodedVideoUrl:", decodedVideoUrl);
  const [isLoading, setIsLoading] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const webcamRef = useRef<HTMLVideoElement>(null);
  const webcamCanvasRef = useRef<HTMLCanvasElement>(null);
  const [webcamDevices, setWebcamDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [resizedVideoWidth, setResizedVideoWidth] = useState<number>(720);
  const [resizedVideoHeight, setResizedVideoHeight] = useState<number>(405);
  const [videoAspectRatio, setVideoAspectRatio] = useState<number>(16 / 9);

  const [videoPoseLandmarker, setVideoPoseLandmarker] = useState<
    PoseLandmarker | undefined
  >(undefined);
  const [webcamPoseLandmarker, setWebcamPoseLandmarker] = useState<
    PoseLandmarker | undefined
  >(undefined);

  const [error, setError] = useState<string | null>(null);
  const videoRafIdRef = useRef<number | null>(null);
  const webcamRafIdRef = useRef<number | null>(null);
  const videoLastFrameIdRef = useRef<number>(0);
  const webcamLastFrameIdRef = useRef<number>(0);
  const videoLastTimestampRef = useRef<number>(performance.now());
  const webcamLastTimestampRef = useRef<number>(performance.now());

  // const rafIdRef = useRef<number | null>(null);
  // const lastTimestampRef = useRef<number>(performance.now());
  // const lastFrameIdRef = useRef<number>(0);
  const [videoDetectedKeypoints, setVideoDetectedKeypoints] = useState<any[]>(
    []
  );
  const [webcamDetectedKeypoints, setWebcamDetectedKeypoints] = useState<any[]>(
    []
  );

  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoStarted, setVideoStarted] = useState(false); // Tracks if video has been started

  const [webcamRunning, setWebcamRunning] = useState(false);

  const createPoseLandmarker = async (type: "video" | "webcam") => {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
      );
      console.log(`${type} WASM files resolved successfully`);

      const modelUrl =
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
      const landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: modelUrl,
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
      });
      console.log(`${type} PoseLandmarker initialized successfully`);
      if (type === "video") {
        setVideoPoseLandmarker(landmarker);
      } else {
        setWebcamPoseLandmarker(landmarker);
      }
    } catch (err: any) {
      console.error(`Error initializing ${type} PoseLandmarker:`, err);
      setError(`Failed to initialize ${type} PoseLandmarker: ${err.message}`);
    }
  };

  const setupVideo = () => {
    if (videoRef.current && !videoStarted) {
      videoRef.current.src = decodedVideoUrl;
      console.log("Video source set to:", videoRef.current.src);
      setVideoDetectedKeypoints([]);

      videoRef.current.onloadeddata = () => {
        console.log(
          "Video file loaded, duration:",
          videoRef.current?.duration,
          "resolution:",
          videoRef.current?.videoWidth,
          videoRef.current?.videoHeight
        );

        const aspectRatio =
          videoRef.current!.videoWidth / videoRef.current!.videoHeight;
        const maxWidth = 720;
        let newWidth = videoRef.current!.videoWidth;
        let newHeight = videoRef.current!.videoHeight;

        if (newWidth > maxWidth) {
          newWidth = maxWidth;
          newHeight = maxWidth / aspectRatio;
        }
        setVideoAspectRatio(aspectRatio);
        setResizedVideoWidth(newWidth);
        setResizedVideoHeight(newHeight);

        videoRef.current!.width = newWidth;
        videoRef.current!.height = newHeight;
        canvasRef.current!.width = newWidth;
        canvasRef.current!.height = newHeight;

        webcamRef.current!.width = newWidth;
        webcamRef.current!.height = newHeight;
        webcamCanvasRef.current!.width = newWidth;
        webcamCanvasRef.current!.height = newHeight;

        console.log("Video dimensions:", {
          videoWidth: videoRef.current!.width,
          videoHeight: videoRef.current!.height,
        });
      };

      videoRef.current.onended = () => {
        console.log("Video ended, stopping prediction");
        setVideoPlaying(false);
        setWebcamRunning(false);
        setVideoStarted(false);
        if (videoRafIdRef.current) cancelAnimationFrame(videoRafIdRef.current);
        if (webcamRafIdRef.current)
          cancelAnimationFrame(webcamRafIdRef.current);
        clearCanvas();
        clearWebcamCanvas();
      };

      videoRef.current.onplay = () => {
        setVideoPlaying(true);
        setWebcamRunning(true);
      };

      videoRef.current.onpause = () => {
        setVideoPlaying(false);
        if (videoRafIdRef.current) cancelAnimationFrame(videoRafIdRef.current);
      };
    }
  };

  const getWebcamDevices = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true });
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      const webcamDevices = deviceList.filter(
        (device) => device.kind === "videoinput"
      );
      setWebcamDevices(webcamDevices);
      if (webcamDevices.length > 0) {
        setSelectedDeviceId(webcamDevices[0].deviceId);
      }
    } catch (err: any) {
      console.error("Error enumerating devices:", err);
      setError(`Failed to enumerate devices: ${err.message}`);
    }
  };

  const setupWebcam = () => {
    if (webcamRef.current && webcamCanvasRef.current) {
      const constraints = {
        video: {
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
          width: resizedVideoWidth, // Force exact width
          height: resizedVideoHeight, // Force exact height
          aspectRatio: videoAspectRatio, // Force exact aspect ratio
        },
      };
      console.log("Webcam constraints:", constraints);
      navigator.mediaDevices
        .getUserMedia(constraints)
        .then((stream) => {
          webcamRef.current!.srcObject = stream;
          webcamRef.current!.play();

          setWebcamDetectedKeypoints([]);
          console.log("Webcam ready");
        })
        .catch((err) => {
          console.error("Error accessing webcam:", err);
          setError(`Failed to access webcam: ${err.message}`);
        });
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

  const clearWebcamCanvas = () => {
    if (webcamCanvasRef.current) {
      const canvasCtx = webcamCanvasRef.current.getContext("2d");
      if (canvasCtx) {
        canvasCtx.clearRect(
          0,
          0,
          webcamCanvasRef.current.width,
          webcamCanvasRef.current.height
        );
        console.log("webcamCanvasRef cleared");
      }
    }
  };

  const predictVideo = (frame_id: number) => {
    if (!videoPoseLandmarker || !videoRef.current || !canvasRef.current) {
      console.log("Prediction skipped:", {
        poseLandmarker: !!videoPoseLandmarker,
        videoRef: !!videoRef.current,
        canvasRef: !!canvasRef.current,
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

    const deltaTime = nowInMs - videoLastTimestampRef.current;
    const fps = 1000 / deltaTime;
    videoLastTimestampRef.current = nowInMs;

    videoPoseLandmarker.detectForVideo(videoRef.current, nowInMs, (result) => {
      canvasCtx.save();
      canvasCtx.clearRect(
        0,
        0,
        canvasRef.current!.width,
        canvasRef.current!.height
      );

      if (result.landmarks.length === 0) {
        console.warn("VIDEO: No landmarks detected in this frame");
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

      let keypoints_data = {
        frame_id: frame_id,
        resolution: [
          videoRef.current!.videoWidth,
          videoRef.current!.videoHeight,
        ],
        video_timestamp: videoRef.current!.currentTime.toFixed(2),
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
                visibility: landmark.visibility,
              }))
            : [],
      };
      console.log("video keypoints:", keypoints_data);
      setVideoDetectedKeypoints((prev) => [...prev, keypoints_data]);
      videoLastFrameIdRef.current = frame_id;

      canvasCtx.restore();
    });

    // Only schedule next frame if video is playing
    if (!videoRef.current.paused && !videoRef.current.ended) {
      videoRafIdRef.current = requestAnimationFrame(() => {
        predictVideo(frame_id + 1);
        // predictWebcam(frame_id + 1);
      });
    }
  };

  const predictWebcam = (frame_id: number) => {
    if (!webcamPoseLandmarker || !webcamRef.current || !canvasRef.current) {
      console.log("Prediction skipped:", {
        poseLandmarker: !!webcamPoseLandmarker,
        webcamRef: !!webcamRef.current,
        canvasRef: !!webcamCanvasRef.current,
        webcamRunning,
      });
      return;
    }

    const canvasCtx = webcamCanvasRef.current!.getContext("2d");
    if (!canvasCtx) {
      console.error("Failed to get canvas context");
      setError("Failed to get canvas context");
      return;
    }

    const drawingUtils = new DrawingUtils(canvasCtx);
    const nowInMs = performance.now();

    // Calculate FPS
    const deltaTime = nowInMs - webcamLastTimestampRef.current;
    const fps = 1000 / deltaTime;
    webcamLastTimestampRef.current = nowInMs;

    webcamPoseLandmarker.detectForVideo(
      webcamRef.current,
      nowInMs,
      (webcamResult) => {
        canvasCtx.save();
        canvasCtx.clearRect(
          0,
          0,
          webcamCanvasRef.current!.width,
          webcamCanvasRef.current!.height
        );

        if (webcamResult.landmarks.length === 0) {
          console.warn("WEBCAM: No landmarks detected in this frame");
        }

        for (const landmark of webcamResult.landmarks) {
          drawingUtils.drawLandmarks(landmark, {
            radius: (data) => DrawingUtils.lerp(data.from!.z, -0.15, 0.1, 5, 1),
            color: "#fff",
            lineWidth: 2,
          });
          drawingUtils.drawConnectors(
            landmark,
            PoseLandmarker.POSE_CONNECTIONS,
            {
              color: "red",
              lineWidth: 2,
            }
          );
        }

        let keypoints_data = {
          frame_id: frame_id,
          resolution: [
            webcamRef.current!.videoWidth,
            webcamRef.current!.videoHeight,
          ],
          webcam_timestamp: webcamRef.current!.currentTime,
          fps: fps.toFixed(2),
          no_of_poses: webcamResult.landmarks.length,
          kpts:
            webcamResult.landmarks &&
            webcamResult.landmarks.length > 0 &&
            webcamResult.landmarks[0]
              ? webcamResult.landmarks[0].map((landmark, index) => ({
                  frame_id: frame_id,
                  kpt_id: index,
                  normalzed_coords: [landmark.x, landmark.y],
                  coords: [
                    landmark.x * webcamRef.current!.videoWidth,
                    landmark.y * webcamRef.current!.videoHeight,
                  ],
                  visibility: landmark.visibility,
                }))
              : [],
        };
        console.log("webcam keypoints:", keypoints_data);
        setWebcamDetectedKeypoints((prev) => [...prev, keypoints_data]);
        webcamLastFrameIdRef.current = frame_id;

        canvasCtx.restore();
      }
    );

    // Only schedule next frame if video is playing
    if (!videoRef.current!.paused && !videoRef.current!.ended) {
      webcamRafIdRef.current = requestAnimationFrame(() => {
        // predictVideo(frame_id + 1);
        predictWebcam(frame_id + 1);
      });
    }
  };

  const handleStart = () => {
    if (
      videoRef.current &&
      videoPoseLandmarker &&
      webcamPoseLandmarker &&
      !videoPlaying
    ) {
      if (!videoStarted) {
        setupVideo();
        setupWebcam();

        if (
          videoRef.current &&
          webcamRef.current &&
          webcamRef.current.srcObject
        ) {
          Promise.all([videoRef.current.play(), webcamRef.current.play()]).then(
            () => {
              setVideoStarted(true);
              setVideoPlaying(true);
              setWebcamRunning(true);
              videoLastFrameIdRef.current = 0;
              webcamLastFrameIdRef.current = 0;

              predictVideo(0);
              predictWebcam(0);
              console.log("Video and webcam started successfully");
            }
          );
        }
      } else {
        // resume
        if (videoRef.current && webcamRef.current) {
          Promise.all([videoRef.current.play(), webcamRef.current.play()])
            .then(() => {
              setVideoPlaying(true);
              setWebcamRunning(true);
              predictVideo(videoLastFrameIdRef.current + 1);
              predictWebcam(webcamLastFrameIdRef.current + 1);
              console.log("Video and webcam resumed");
            })
            .catch((err) => {
              console.error("Error resuming video or webcam:", err);
              setError(`Error resuming playback: ${err.message}`);
            });
        }
      }
    }
  };

  const handlePause = () => {
    if (videoRef.current && videoPlaying) {
      videoRef.current.pause();
      if (webcamRef.current) webcamRef.current.pause();
      setVideoPlaying(false);
      setWebcamRunning(false);
      if (videoRafIdRef.current) cancelAnimationFrame(videoRafIdRef.current);
      if (webcamRafIdRef.current) cancelAnimationFrame(webcamRafIdRef.current);
      console.log("Video and webcam paused at frames:", {
        video: videoLastFrameIdRef.current,
        webcam: webcamLastFrameIdRef.current,
      });
    }
  };

  const handleResume = () => {
    if (videoRef.current && videoStarted && !videoPlaying) {
      if (webcamRef.current) {
        Promise.all([videoRef.current.play(), webcamRef.current.play()])
          .then(() => {
            setVideoPlaying(true);
            setWebcamRunning(true);
            predictVideo(videoLastFrameIdRef.current + 1);
            predictWebcam(webcamLastFrameIdRef.current + 1);
            console.log("Video and webcam resumed");
          })
          .catch((err) => {
            console.error("Error resuming video or webcam:", err);
            setError(`Error resuming playback: ${err.message}`);
          });
      }
    }
  };

  useEffect(() => {
    setupWebcam();
  }, [selectedDeviceId]);

  useEffect(() => {
    if (videoPoseLandmarker && webcamPoseLandmarker) {
      setupVideo();
      setupWebcam();
    }
  }, [videoPoseLandmarker, webcamPoseLandmarker]);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([createPoseLandmarker("video"), createPoseLandmarker("webcam")])
      .then(() => setIsLoading(false))
      .catch((err) =>
        console.error("Error initializing PoseLandmarkers:", err)
      );
    getWebcamDevices();
    // Check if Blob URL is valid on mount
    fetch(decodedVideoUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Blob URL not found");
        }
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Blob URL expired or invalid:", err);
        setError("Blob URL expired or invalid");
      });

    return () => {
      if (videoRafIdRef.current) cancelAnimationFrame(videoRafIdRef.current);
      if (webcamRafIdRef.current) cancelAnimationFrame(webcamRafIdRef.current);
      if (webcamRef.current && webcamRef.current.srcObject) {
        (webcamRef.current.srcObject as MediaStream)
          .getTracks()
          .forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    setIsLoading(true);
    if (error == "Blob URL expired or invalid") {
      router.push("/");
    } else {
      setIsLoading(false);
    }
  }, [error]);

  return (
    <div className="flex justify-center items-start">
      {isLoading ? (
        <div className="w-screen h-screen flex justify-center items-center">
          <PulseLoader
            color={`var(--color--custom-primary)`}
            // color={"#395EFC"}
            loading={isLoading}
            size={14}
            aria-label="Loading Spinner"
            data-testid="loader"
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
            // cssOverride={{ display: "block", margin: "0 auto" }}
          />
        </div>
      ) : (
        <div className="w-full h-full mt-5 flex flex-col items-center justify-center gap-2 max-w-[1200px]">
          <div className="w-full flex justify-center items-center gap-2 mt-2">
            <div className="w-[50%] flex justify-start items-center gap-2">
              {videoPlaying ? (
                <Button
                  className="hover:rounded-[5px] w-7 h-7 text-white flex justify-center items-center cursor-pointer"
                  onClick={handlePause}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 25 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    transform="rotate(0 0 0)"
                  >
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M7 3.25C5.75736 3.25 4.75 4.25736 4.75 5.5V18.4999C4.75 19.7426 5.75736 20.75 7 20.75H8.75C9.99264 20.75 11 19.7426 11 18.4999V5.5C11 4.25736 9.99264 3.25 8.75 3.25H7ZM6.25 5.5C6.25 5.08579 6.58579 4.75 7 4.75H8.75C9.16421 4.75 9.5 5.08579 9.5 5.5V18.4999C9.5 18.9142 9.16421 19.2499 8.75 19.2499H7C6.58579 19.2499 6.25 18.9142 6.25 18.4999V5.5Z"
                      fill="#fff"
                    />
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M16.25 3.25C15.0074 3.25 14 4.25736 14 5.5V18.4999C14 19.7426 15.0074 20.75 16.25 20.75H18C19.2426 20.75 20.25 19.7426 20.25 18.4999V5.5C20.25 4.25736 19.2426 3.25 18 3.25H16.25ZM15.5 5.5C15.5 5.08579 15.8358 4.75 16.25 4.75H18C18.4142 4.75 18.75 5.08579 18.75 5.5V18.4999C18.75 18.9142 18.4142 19.2499 18 19.2499H16.25C15.8358 19.2499 15.5 18.9142 15.5 18.4999V5.5Z"
                      fill="#fff"
                    />
                  </svg>
                </Button>
              ) : (
                <Button
                  className="hover:rounded-[5px] w-7 h-7 text-white flex justify-center items-center  cursor-pointer"
                  onClick={videoStarted ? handleResume : handleStart}
                  disabled={!videoPoseLandmarker || !webcamPoseLandmarker}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 25 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    transform="rotate(0 0 0)"
                  >
                    <path
                      d="M19.4357 13.9174C20.8659 13.0392 20.8659 10.9608 19.4357 10.0826L9.55234 4.01389C8.05317 3.09335 6.125 4.17205 6.125 5.93128L6.125 18.0688C6.125 19.828 8.05317 20.9067 9.55234 19.9861L19.4357 13.9174ZM18.6508 11.3609C19.1276 11.6536 19.1276 12.3464 18.6508 12.6391L8.76745 18.7079C8.26772 19.0147 7.625 18.6552 7.625 18.0688L7.625 5.93128C7.625 5.34487 8.26772 4.9853 8.76745 5.29215L18.6508 11.3609Z"
                      fill="#fff"
                      fillRule="evenodd"
                      clipRule="evenodd"
                    />
                  </svg>
                </Button>
              )}
            </div>
            <div className="w-[50%] flex justify-start items-center gap-2">
              <p className="text-custom-on-surface-container">Webcam:</p>
              {webcamDevices && (
                <Select
                  value={selectedDeviceId || webcamDevices[0]?.deviceId}
                  onValueChange={(value) => setSelectedDeviceId(value)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select a webcam" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Devies</SelectLabel>
                      {webcamDevices.length > 0 &&
                        webcamDevices.map((device) => (
                          <SelectItem
                            key={device.deviceId}
                            value={device.deviceId}
                          >
                            {device.label || `Device ${device.deviceId}`}
                          </SelectItem>
                        ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <div className=" w-full flex items-start justify-center gap-4">
            <div className="relative w-[50%]">
              <video
                ref={videoRef}
                width={resizedVideoWidth} // Bind to state
                height={resizedVideoHeight} // Bind to state
                playsInline
                className="rounded-md border-2"
              />
              <canvas
                ref={canvasRef}
                width={resizedVideoWidth}
                height={resizedVideoHeight}
                className="absolute top-0 left-0 w-full h-full rounded-md"
              />
            </div>
            <div className="relative w-[50%]">
              <video
                ref={webcamRef}
                width={resizedVideoWidth} // Bind to state
                height={resizedVideoHeight} // Bind to state
                playsInline
                className="rounded-md border-2"
              />
              {/* <Webcam 
                ref={webcamRef}
                videoConstraints={{
                  width: resizedVideoWidth,
                  height: resizedVideoHeight,
                  facingMode: "user",
                }}
                className="rounded-md border-2"
              /> */}
              <canvas
                ref={webcamCanvasRef}
                width={resizedVideoWidth} // Bind to state
                height={resizedVideoHeight} // Bind to state
                // width={resizedVideoWidth} // Bind to state
                // height={resizedVideoHeight} // Bind to state
                className="absolute top-0 left-0 w-full h-full rounded-md"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default page;
