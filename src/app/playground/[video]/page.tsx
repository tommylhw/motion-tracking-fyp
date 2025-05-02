"use client";
import React, { use, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  FilesetResolver,
  PoseLandmarker,
  DrawingUtils,
} from "@mediapipe/tasks-vision";
import { PulseLoader } from "react-spinners";
import { drawAngles } from "@/utils/AnglesUtils";

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
import ElasticSlider from "@/reactbit/ElasticSlider/ElasticSlider";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

// context
import { useVideo } from "@/context/VideoContext";

// icons
import { RiSpeedUpFill } from "react-icons/ri";

// components
import ThinkingAnimation from "@/components/ThinkingAnimation";
import { FpsChart } from "@/components/FpsChart";

// Define the type for a single keypoint
type KEYPOINT_TYPE = {
  frame_id: number;
  kpt_id: number;
  normalized_coords: number[];
  coords: number[];
  visibility: number;
};

// Define the main type for video detected keypoints
type VIDEO_DETECTED_KEYPOINTS_TYPE = {
  frame_id: number;
  resolution: number[];
  video_timestamp: string;
  fps: string;
  avg_fps: string;
  no_of_poses: number;
  kpts: KEYPOINT_TYPE[];
};

// Define the type for a single keypoint
type WEBCAM_KEYPOINT_TYPE = {
  frame_id: number;
  kpt_id: number;
  normalized_coords: number[];
  coords: number[];
  visibility: number;
  skeleton_normalized_coords: number[] | null;
  skeleton_coords: number[] | null;
  distance: number | null;
};

// Define the main type for webcam detected keypoints
type WEBCAM_DETECTED_KEYPOINTS_TYPE = {
  frame_id: number;
  resolution: number[];
  webcam_timestamp: number;
  fps: string;
  avg_fps: string;
  no_of_poses: number;
  kpts: WEBCAM_KEYPOINT_TYPE[];
};

// Type for RMS and Score metrics
type MetricsType = {
  max_distance: number;
  min_distance: number;
  mean_distance: number;
  median_distance: number;
  std_distance: number;
  overall_rms: number;
  percentage_low_rms: number;
  matching_quality: string;
  overall_quality: string;
  overall_score: number;
};

const Page = ({ params }: { params: Promise<{ video: string }> }) => {
  const router = useRouter();
  const { video } = use(params);
  const { encodedVideoUrl } = useVideo();
  const [decodedVideoUrl, setDecodedVideoUrl] = useState<string>(
    decodeURIComponent(encodedVideoUrl || "") || decodeURIComponent(video)
  );
  const [isLoading, setIsLoading] = useState(true);
  const videoSpeed = useRef<number>(1);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const webcamRef = useRef<HTMLVideoElement>(null);
  const webcamCanvasRef = useRef<HTMLCanvasElement>(null);
  const [webcamDevices, setWebcamDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  const resizedVideoWidth = useRef<number>(720);
  const resizedVideoHeight = useRef<number>(405);
  const videoAspectRatio = useRef<number>(16 / 9);

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

  const videoDetectedKeypointsRef = useRef<VIDEO_DETECTED_KEYPOINTS_TYPE[]>([]);
  const webcamDetectedKeypointsRef = useRef<WEBCAM_DETECTED_KEYPOINTS_TYPE[]>([]);

  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoStarted, setVideoStarted] = useState(false);
  const [webcamRunning, setWebcamRunning] = useState(false);

  const [isThinking, setIsThinking] = useState(true);
  const updateKeypointsRef = useRef<
    (keypoints: VIDEO_DETECTED_KEYPOINTS_TYPE[]) => void
  >(() => {});

  // Metrics state
  const [metrics, setMetrics] = useState<MetricsType>({
    max_distance: 0,
    min_distance: 0,
    mean_distance: 0,
    median_distance: 0,
    std_distance: 0,
    overall_rms: 0,
    percentage_low_rms: 0,
    matching_quality: "N/A",
    overall_quality: "N/A",
    overall_score: 0,
  });

  useEffect(() => {
    setIsThinking(videoPlaying);
  }, [videoPlaying]);

  const calculateRmsAndScore = (
    keypoints: WEBCAM_DETECTED_KEYPOINTS_TYPE[]
  ): MetricsType => {
    // Collect all valid distances
    const distances = keypoints
      .flatMap((frame) => frame.kpts)
      .filter(
        (kpt) =>
          kpt.distance !== null &&
          kpt.distance !== undefined &&
          isFinite(kpt.distance)
      )
      .map((kpt) => kpt.distance!);

    if (distances.length === 0) {
      return {
        max_distance: 0,
        min_distance: 0,
        mean_distance: 0,
        median_distance: 0,
        std_distance: 0,
        overall_rms: 0,
        percentage_low_rms: 0,
        matching_quality: "N/A",
        overall_quality: "N/A",
        overall_score: 0,
      };
    }

    // Calculate statistics
    const max_distance = Math.max(...distances);
    const min_distance = Math.min(...distances);
    const mean_distance = distances.reduce((sum, d) => sum + d, 0) / distances.length;

    // Median calculation
    const sortedDistances = [...distances].sort((a, b) => a - b);
    const mid = Math.floor(sortedDistances.length / 2);
    const median_distance =
      sortedDistances.length % 2 === 0
        ? (sortedDistances[mid - 1] + sortedDistances[mid]) / 2
        : sortedDistances[mid];

    // Standard deviation
    const variance =
      distances.reduce((sum, d) => sum + Math.pow(d - mean_distance, 2), 0) /
      distances.length;
    const std_distance = Math.sqrt(variance);

    // RMS
    const overall_rms = mean_distance; // Simplified, as in demo.py

    // Percentage of low RMS keypoints
    const threshold = 80; // Pixel threshold
    const low_rms_count = distances.filter((d) => d <= threshold).length;
    const total_keypoints = distances.length;
    const percentage_low_rms = (low_rms_count / total_keypoints) * 100;

    // Matching quality
    let matching_quality: string;
    if (percentage_low_rms > 80) {
      matching_quality = "Perfect matching";
    } else if (percentage_low_rms >= 50) {
      matching_quality = "Good matching";
    } else if (percentage_low_rms >= 30) {
      matching_quality = "Not matching enough";
    } else {
      matching_quality = "Poor matching";
    }

    // Overall quality
    const overall_rms_threshold = 40; // Pixel threshold
    let overall_quality: string;
    if (overall_rms <= overall_rms_threshold) {
      overall_quality = "Overall perfect";
    } else if (overall_rms <= 60) {
      overall_quality = "Overall not bad";
    } else {
      overall_quality = "Overall poor";
    }

    // Calculate overall score
    const match_percentages = keypoints
      .filter((frame) => frame.kpts.length > 0)
      .map((frame) => {
        const matched_count = frame.kpts.filter(
          (kpt) => kpt.distance !== null && kpt.distance <= 80
        ).length;
        const total_kpts = frame.kpts.filter(
          (kpt) => kpt.visibility !== undefined && kpt.visibility > 0.5
        ).length;
        return total_kpts > 0 ? (matched_count / total_kpts) * 100 : 0;
      });
    const overall_score = match_percentages.length > 0
      ? Math.round(
          match_percentages.reduce((sum, p) => sum + p, 0) / match_percentages.length
        )
      : 0;

    return {
      max_distance,
      min_distance,
      mean_distance,
      median_distance,
      std_distance,
      overall_rms,
      percentage_low_rms,
      matching_quality,
      overall_quality,
      overall_score,
    };
  };

  // Update metrics when keypoints change
  useEffect(() => {
    if (webcamDetectedKeypointsRef.current.length > 0 && videoPlaying) {
      const newMetrics = calculateRmsAndScore(webcamDetectedKeypointsRef.current);
      // setMetrics(newMetrics);
    }
  }, [webcamDetectedKeypointsRef.current, videoPlaying]);

  const createPoseLandmarker = async (type: "video" | "webcam") => {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
      );
      console.log(`${type} WASM files resolved successfully`);

      const modelLiteUrl =
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";
      const landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: modelLiteUrl,
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
        minPoseDetectionConfidence: 0.8,
        minPosePresenceConfidence: 0.8,
        minTrackingConfidence: 0.8,
      });
      console.log(`${type} PoseLandmarker initialized successfully`);
      if (type === "video") {
        setVideoPoseLandmarker(landmarker);
      } else {
        setWebcamPoseLandmarker(landmarker);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error(`Error initializing ${type} PoseLandmarker:`, errorMessage);
      setError(`Failed to initialize ${type} PoseLandmarker: ${errorMessage}`);
    }
  };

  const setupVideo = async () => {
    if (videoRef.current && !videoStarted) {
      videoRef.current.src = decodedVideoUrl;
      console.log("Video source set to:", videoRef.current.src);
      videoDetectedKeypointsRef.current = [];

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

        resizedVideoWidth.current = newWidth;
        resizedVideoHeight.current = newHeight;
        videoAspectRatio.current = aspectRatio;

        videoRef.current!.width = newWidth;
        videoRef.current!.height = newHeight;
        canvasRef.current!.width = newWidth;
        canvasRef.current!.height = newHeight;

        webcamRef.current!.width = newWidth;
        webcamRef.current!.height = newHeight;
        webcamCanvasRef.current!.width = newWidth;
        webcamCanvasRef.current!.height = newHeight;

        console.log("Video dimensions:", {
          videoWidth: resizedVideoWidth.current,
          videoHeight: resizedVideoHeight.current,
          dimension: videoAspectRatio.current,
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
      if (selectedDeviceId === null && webcamDevices.length > 0) {
        setSelectedDeviceId(webcamDevices[0].deviceId);
      }
      return webcamDevices;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error("Error accessing webcam:", errorMessage);
      setError(`Failed to access webcam: ${errorMessage}`);
    }
  };

  const setupWebcam = async () => {
    console.log("setupWebcam: Starting, webcamDevices:", webcamDevices);
    if (!webcamRef.current || !webcamCanvasRef.current) {
      throw new Error("Webcam or canvas element not initialized");
    }

    if (!webcamDevices.length) {
      console.log("setupWebcam: No webcam devices found, fetching devices...");
      await getWebcamDevices();
    }

    const deviceId = selectedDeviceId || (await getWebcamDevices().then((devices) => devices![0].deviceId));
    console.log("setupWebcam: Using device ID:", deviceId);

    if (webcamRef.current && webcamCanvasRef.current) {
      console.log("Setting up webcam with device ID:", selectedDeviceId);
      const constraints = {
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: resizedVideoWidth.current,
          height: resizedVideoHeight.current,
          aspectRatio: { exact: videoAspectRatio.current },
        },
      };
      console.log("Webcam constraints:", constraints);
      navigator.mediaDevices
        .getUserMedia(constraints)
        .then((stream) => {
          webcamRef.current!.srcObject = stream;
          webcamRef.current!.play();
          webcamDetectedKeypointsRef.current = [];
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

      for (const landmarks of result.landmarks) {
        if (!Array.isArray(landmarks)) {
          console.error("Landmarks is not an array:", landmarks);
          continue;
        }

        drawingUtils.drawLandmarks(landmarks, {
          radius: (data) => DrawingUtils.lerp(data.from!.z, -0.15, 0.1, 5, 1),
          color: "#fff",
          lineWidth: 2,
        });
        drawingUtils.drawConnectors(
          landmarks,
          PoseLandmarker.POSE_CONNECTIONS,
          {
            color: "rgba(242, 165, 88, 0.7)",
            lineWidth: 2,
          }
        );
      }

      const prevKeypoints = videoDetectedKeypointsRef.current;
      const prevAvgFps =
        prevKeypoints.length > 0
          ? parseFloat(prevKeypoints[prevKeypoints.length - 1].avg_fps)
          : 0;
      const frameCount = frame_id + 1;
      const avg_fps =
        frameCount === 1 ? fps : prevAvgFps + (fps - prevAvgFps) / frameCount;

      const keypoints_data = {
        frame_id: frame_id,
        resolution: [
          videoRef.current!.videoWidth,
          videoRef.current!.videoHeight,
        ],
        video_timestamp: videoRef.current!.currentTime.toFixed(2),
        fps: fps.toFixed(2),
        avg_fps: avg_fps.toFixed(2),
        no_of_poses: result.landmarks.length,
        kpts:
          result.landmarks && result.landmarks.length > 0 && result.landmarks[0]
            ? result.landmarks[0].map((landmark, index) => ({
                frame_id: frame_id,
                kpt_id: index,
                normalized_coords: [landmark.x, landmark.y, landmark.z],
                coords: [
                  landmark.x * webcamRef.current!.videoWidth,
                  landmark.y * webcamRef.current!.videoHeight,
                  landmark.z,
                ],
                visibility: landmark.visibility,
              }))
            : [],
      };

      if (keypoints_data.kpts.length > 0) {
        drawAngles(
          canvasCtx,
          keypoints_data.kpts,
          canvasRef.current!.width,
          canvasRef.current!.height
        );
      }

      videoDetectedKeypointsRef.current = [
        ...videoDetectedKeypointsRef.current,
        keypoints_data,
      ];
      videoLastFrameIdRef.current = frame_id;

      if (frame_id % 1 == 0) {
        updateKeypointsRef.current(videoDetectedKeypointsRef.current);
      }

      canvasCtx.restore();
    });

    if (!videoRef.current.paused && !videoRef.current.ended) {
      videoRafIdRef.current = requestAnimationFrame(() => {
        predictVideo(frame_id + 1);
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

        const skeletonKeypoint = videoDetectedKeypointsRef.current.find(
          (k) => k.frame_id == frame_id
        );

        if (skeletonKeypoint && skeletonKeypoint.kpts.length > 0) {
          const landmarks = skeletonKeypoint.kpts.map((kpt) => ({
            x: kpt.normalized_coords[0],
            y: kpt.normalized_coords[1],
            z: kpt.normalized_coords[2],
            visibility: kpt.visibility,
          }));
          drawingUtils.drawLandmarks(landmarks, {
            radius: (data) => DrawingUtils.lerp(data.from!.z, -0.15, 0.1, 5, 1),
            color: "rgba(152, 152, 154, 0.3)",
            lineWidth: 30,
          });
          drawingUtils.drawConnectors(
            landmarks,
            PoseLandmarker.POSE_CONNECTIONS,
            {
              color: "rgba(152, 152, 154, 0.4)",
              lineWidth: 30,
            }
          );
        }

        if (webcamResult.landmarks.length === 0) {
          console.warn("WEBCAM: No landmarks detected in this frame");
        }

        const distances: { [kpt_id: number]: number } = {};

        for (const landmarks of webcamResult.landmarks) {
          if (!Array.isArray(landmarks)) {
            console.error("Landmarks is not an array:", landmarks);
            continue;
          }

          drawingUtils.drawLandmarks(landmarks, {
            radius: (data) => DrawingUtils.lerp(data.from!.z, -0.15, 0.1, 5, 1),
            color: "#fff",
            lineWidth: 2,
          });
          drawingUtils.drawConnectors(
            landmarks,
            PoseLandmarker.POSE_CONNECTIONS,
            {
              color: "rgba(121, 192, 255, 0.7)",
              lineWidth: 2,
            }
          );

          const skeletonKpts = skeletonKeypoint ? skeletonKeypoint.kpts : [];

          if (skeletonKpts.length > 0) {
            skeletonKpts.forEach((skeletonKpt) => {
              const skeletonX = skeletonKpt.coords[0];
              const skeletonY = skeletonKpt.coords[1];
              const kptId = skeletonKpt.kpt_id;

              const webcamKptRaw = webcamResult.landmarks[0][kptId];
              let distance: number;

              if (webcamKptRaw) {
                const webcamX = webcamKptRaw.x * webcamRef.current!.videoWidth;
                const webcamY = webcamKptRaw.y * webcamRef.current!.videoHeight;
                distance = Math.sqrt(
                  Math.pow(skeletonX - webcamX, 2) +
                    Math.pow(skeletonY - webcamY, 2)
                );
              } else {
                distance = Infinity;
              }

              distances[kptId] = isFinite(distance) ? distance : 9999;

              const color =
                distance < 20 ? "rgba(96, 237, 40, 1)" : "rgba(229, 37, 8, 1)";

              canvasCtx.beginPath();
              canvasCtx.arc(
                skeletonKpt.normalized_coords[0] *
                  webcamCanvasRef.current!.width,
                skeletonKpt.normalized_coords[1] *
                  webcamCanvasRef.current!.height,
                5,
                0,
                2 * Math.PI
              );
              canvasCtx.fillStyle = color;
              canvasCtx.fill();
              canvasCtx.closePath();
            });
          }

          const prevKeypoints = webcamDetectedKeypointsRef.current;
          const prevAvgFps =
            prevKeypoints.length > 0
              ? parseFloat(prevKeypoints[prevKeypoints.length - 1].avg_fps)
              : 0;
          const frameCount = frame_id + 1;
          const avg_fps =
            frameCount === 1
              ? fps
              : prevAvgFps + (fps - prevAvgFps) / frameCount;

          const keypoints_data = {
            frame_id: frame_id,
            resolution: [
              webcamRef.current!.videoWidth,
              webcamRef.current!.videoHeight,
            ],
            webcam_timestamp: webcamRef.current!.currentTime,
            fps: fps.toFixed(2),
            avg_fps: avg_fps.toFixed(2),
            no_of_poses: webcamResult.landmarks.length,
            kpts:
              webcamResult.landmarks &&
              webcamResult.landmarks.length > 0 &&
              webcamResult.landmarks[0]
                ? webcamResult.landmarks[0].map((landmark, index) => {
                    const matchingSkeletonKpt = skeletonKeypoint?.kpts.find(
                      (kpt) => kpt.kpt_id === index
                    );

                    return {
                      frame_id: frame_id,
                      kpt_id: index,
                      normalized_coords: [landmark.x, landmark.y, landmark.z],
                      coords: [
                        landmark.x * webcamRef.current!.videoWidth,
                        landmark.y * webcamRef.current!.videoHeight,
                        landmark.z,
                      ],
                      visibility: landmark.visibility,
                      skeleton_normalized_coords: matchingSkeletonKpt
                        ? matchingSkeletonKpt.normalized_coords
                        : null,
                      skeleton_coords: matchingSkeletonKpt
                        ? matchingSkeletonKpt.coords
                        : null,
                      distance: distances[index] || null,
                    };
                  })
                : [],
          };

          webcamDetectedKeypointsRef.current = [
            ...webcamDetectedKeypointsRef.current,
            keypoints_data,
          ];
          webcamLastFrameIdRef.current = frame_id;

          canvasCtx.restore();
        }
      }
    );

    if (!videoRef.current!.paused && !videoRef.current!.ended) {
      webcamRafIdRef.current = requestAnimationFrame(() => {
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
        if (
          videoRef.current &&
          webcamRef.current &&
          webcamRef.current.srcObject
        ) {
          videoRef.current.playbackRate = videoSpeed.current;
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
        if (videoRef.current && webcamRef.current) {
          videoRef.current.playbackRate = videoSpeed.current;
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
    if (
      videoRef.current &&
      webcamRef.current &&
      videoStarted &&
      !videoPlaying
    ) {
      videoRef.current.playbackRate = videoSpeed.current;
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
  };

  const handleAdjustSpeed = (speed: number) => {
    videoSpeed.current = speed;
    console.log("Video speed adjusted to:", videoSpeed.current);
    if (videoRef.current) {
      videoRef.current.playbackRate = videoSpeed.current;
    }
  };

  const initialize = async () => {
    try {
      if (!decodedVideoUrl) throw new Error("No video URL provided");

      if (!videoPoseLandmarker && !webcamPoseLandmarker) {
        console.log("Initializing PoseLandmarkers...");
        await Promise.all([
          createPoseLandmarker("video"),
          createPoseLandmarker("webcam"),
        ]);
      }

      console.log("initialize: Fetching webcam devices...");
      await getWebcamDevices();
      if (webcamDevices.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(webcamDevices[0].deviceId);
      }

      console.log("Setting up video and webcam...");
      console.table({
        videoRef: videoRef.current,
        webcamRef: webcamRef.current,
        decodedVideoUrl: decodedVideoUrl,
        webcamDevices: webcamDevices,
      });

      await setupVideo();
      await setupWebcam();
      setIsLoading(false);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "An unknown error occurred";
      console.error("Initialization error:", err);
      setError(errorMessage);
      if (errorMessage.includes("Blob URL expired or invalid")) {
        router.push("/");
      }
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);

    const checkRef = () => {
      if (videoRef.current && webcamRef.current && webcamDevices) {
        console.log("ref is ready, initializing...");
        initialize();
      } else {
        console.log("ref is null, polling...");
        setTimeout(checkRef, 1000);
      }
    };

    checkRef();

    return () => {
      if (videoRafIdRef.current) cancelAnimationFrame(videoRafIdRef.current);
      if (webcamRafIdRef.current) cancelAnimationFrame(webcamRafIdRef.current);
      if (webcamRef.current?.srcObject) {
        (webcamRef.current.srcObject as MediaStream)
          .getTracks()
          .forEach((track) => track.stop());
      }
    };
  }, [decodedVideoUrl]);

  useEffect(() => {
    if (selectedDeviceId && webcamDevices.length > 0) {
      console.log("useEffect: Switching webcam to device ID:", selectedDeviceId);
      setupWebcam();
    }
  }, [selectedDeviceId, webcamDevices]);

  useEffect(() => {
    if (encodedVideoUrl) {
      const newDecodedUrl = decodeURIComponent(encodedVideoUrl);
      setDecodedVideoUrl(newDecodedUrl);
    }
  }, [encodedVideoUrl]);

  useEffect(() => {
    if (error) {
      toast(error);
    }
  }, [error]);

  return (
    <div className="flex justify-center items-start p-[10px]">
      {isLoading && (
        <div className="w-screen h-screen flex justify-center items-center border-2">
          <PulseLoader
            color={"#181818"}
            loading={isLoading}
            speedMultiplier={0.5}
            size={14}
            aria-label="Loading Spinner"
            data-testid="loader"
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
          />
        </div>
      )}

      <div
        className="w-full h-full mt-5 flex flex-col items-center justify-center gap-2 max-w-[1200px]"
        style={{
          display: isLoading ? "none" : "flex",
        }}
      >
        <div className="w-full flex items-start justify-center gap-4">
          <div className="relative w-[50%] shadow-(--shadow-custom-light) rounded-md">
            <video
              ref={videoRef}
              width={resizedVideoWidth.current}
              height={resizedVideoHeight.current}
              playsInline
              className="rounded-md"
            />
            <canvas
              ref={canvasRef}
              width={resizedVideoWidth.current}
              height={resizedVideoHeight.current}
              className="absolute top-0 left-0 w-full h-full rounded-md"
            />
          </div>
          <div className="relative w-[50%] shadow-(--shadow-custom-light) rounded-md">
            <video
              ref={webcamRef}
              width={resizedVideoWidth.current}
              height={resizedVideoHeight.current}
              playsInline
              className="rounded-md"
            />
            <canvas
              ref={webcamCanvasRef}
              width={resizedVideoWidth.current}
              height={resizedVideoHeight.current}
              className="absolute top-0 left-0 w-full h-full rounded-md"
            />
          </div>
        </div>
        <div className="w-full flex justify-center items-center gap-2 mt-1">
          <div className="w-[50%] h-full flex justify-between items-center gap-2 bg-custom-surface rounded-md px-[6px] border-1">
            <div>
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
                  className="hover:rounded-[5px] w-7 h-7 text-white flex justify-center items-center cursor-pointer"
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
            <div className="flex justify-start items-center gap-6">
              <p className="text-custom-on-surface-container text-[12px]">
                Speed:
              </p>
              <ElasticSlider
                leftIcon={
                  <RiSpeedUpFill className="text-custom-on-surface-container" />
                }
                startingValue={0}
                defaultValue={100}
                maxValue={200}
                isStepped={false}
                onValueChange={(value) => handleAdjustSpeed(value / 100)}
              />
            </div>
          </div>
          <div className="w-[50%] h-full flex justify-start items-center gap-2">
            {webcamDevices && (
              <Select
                value={selectedDeviceId || webcamDevices[0]?.deviceId}
                onValueChange={(value) => setSelectedDeviceId(value)}
              >
                <SelectTrigger className="w-[180px] cursor-pointer h-full">
                  <SelectValue placeholder="Select a webcam" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Devices</SelectLabel>
                    {webcamDevices.length > 0 &&
                      webcamDevices.map((device) => (
                        <SelectItem
                          key={device.deviceId}
                          value={device.deviceId}
                          className="cursor-pointer"
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

        <div className="w-full flex flex-col justify-start items-start gap-2 my-2">
          

          <div className="w-full">
            <FpsChart
              videoDetectedKeypointsRef={videoDetectedKeypointsRef}
              webcamDetectedKeypointsRef={webcamDetectedKeypointsRef}
              videoPlaying={videoPlaying}
            />
          </div>

          <div className="w-full">
            <ThinkingAnimation
              isThinking={isThinking}
              updateKeypoints={(callback) => {
                updateKeypointsRef.current = callback;
              }}
            />
          </div>

          {/* Metrics Display */}
          <div className="w-full bg-custom-surface rounded-md p-4 shadow-md my-[8px]">
            <h3 className="text-lg font-semibold text-custom-on-surface">
              Tracking Result
            </h3>
            <div className="mt-2 text-sm text-custom-on-surface-container">
              <p>Matching Quality: {metrics.matching_quality}</p>
              <p>Overall RMS Quality: {metrics.overall_quality}</p>
              <p>Overall Score: {metrics.overall_score}%</p>
            </div>
          </div>
        </div>
      </div>
      <Toaster />
    </div>
  );
};

export default Page;