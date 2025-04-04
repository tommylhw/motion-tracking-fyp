"use client";
import React, { use, useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  FilesetResolver,
  PoseLandmarker,
  DrawingUtils,
} from "@mediapipe/tasks-vision";
import { PulseLoader } from "react-spinners";

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

// context
import { useVideo } from "@/context/VideoContext";

// icons
import { FaPause, FaPlay, FaStop } from "react-icons/fa";
import { CiPlay1, CiPause1 } from "react-icons/ci";
import { RiSpeedUpFill } from "react-icons/ri";
import { FpsChart } from "@/components/FpsChart";

const page = ({ params }: { params: Promise<{ video: string }> }) => {
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
  // const [resizedVideoWidth, setResizedVideoWidth] = useState<number>(720);
  // const [resizedVideoHeight, setResizedVideoHeight] = useState<number>(405);
  // const [videoAspectRatio, setVideoAspectRatio] = useState<number>(16 / 9);

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

  const [videoDetectedKeypoints, setVideoDetectedKeypoints] = useState<any[]>(
    []
  );
  const [webcamDetectedKeypoints, setWebcamDetectedKeypoints] = useState<any[]>(
    []
  );
  const videoDetectedKeypointsRef = useRef<any[]>([]);
  const webcamDetectedKeypointsRef = useRef<any[]>([]);

  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoStarted, setVideoStarted] = useState(false); // Tracks if video has been started

  const [webcamRunning, setWebcamRunning] = useState(false);

  /* // START: customize detection keypoints drawing
  // Define left and right side indices
  const leftSideIndices = [11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31]; // Left shoulder, elbow, wrist, hip, knee, ankle, heel, foot
  const rightSideIndices = [12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32]; // Right shoulder, elbow, wrist, hip, knee, ankle, heel, foot

  // Hardcoded pose connections (based on BlazePose topology)
  const POSE_CONNECTIONS: [number, number][] = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 7], // Face left
    [0, 4],
    [4, 5],
    [5, 6],
    [6, 8], // Face right
    [9, 10], // Mouth
    [11, 12], // Shoulders
    [11, 13],
    [13, 15], // Left arm
    [12, 14],
    [14, 16], // Right arm
    [11, 23],
    [12, 24], // Shoulders to hips
    [23, 24], // Hips
    [23, 25],
    [25, 27],
    [27, 29],
    [29, 31], // Left leg
    [24, 26],
    [26, 28],
    [28, 30],
    [30, 32], // Right leg
    [15, 17],
    [17, 19],
    [15, 21], // Left hand
    [16, 18],
    [18, 20],
    [16, 22], // Right hand
  ];

  // Compute connections once
  const leftConnections = POSE_CONNECTIONS.filter(
    ([start, end]) =>
      leftSideIndices.includes(start) && leftSideIndices.includes(end)
  ).map(([start, end]) => ({ start, end }));
  const rightConnections = POSE_CONNECTIONS.filter(
    ([start, end]) =>
      rightSideIndices.includes(start) && rightSideIndices.includes(end)
  ).map(([start, end]) => ({ start, end }));
  const neutralConnections = POSE_CONNECTIONS.filter(
    ([start, end]) =>
      !(leftSideIndices.includes(start) && leftSideIndices.includes(end)) &&
      !(rightSideIndices.includes(start) && rightSideIndices.includes(end))
  ).map(([start, end]) => ({ start, end }));
  // END: customize detection keypoints drawing */

  const createPoseLandmarker = async (type: "video" | "webcam") => {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
      );
      console.log(`${type} WASM files resolved successfully`);

      const modelLiteUrl =
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";
      const modelFullUrl =
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task";
      const modelHeavyUrl =
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task";
      const landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: modelLiteUrl,
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
        // setVideoAspectRatio(aspectRatio);
        // setResizedVideoWidth(newWidth);
        // setResizedVideoHeight(newHeight);

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
    } catch (err: any) {
      console.error("Error enumerating devices:", err);
      setError(`Failed to enumerate devices: ${err.message}`);
    }
  };

  const setupWebcam = () => {
    if (webcamRef.current && webcamCanvasRef.current) {
      console.log("Setting up webcam with device ID:", selectedDeviceId);
      const constraints = {
        video: {
          deviceId: selectedDeviceId
            ? { exact: selectedDeviceId }
            : webcamDevices[0].deviceId,
          width: resizedVideoWidth.current, // Force exact width
          height: resizedVideoHeight.current, // Force exact height
          aspectRatio: videoAspectRatio.current, // Force exact aspect ratio
        },
      };
      console.log("Webcam constraints:", constraints);
      navigator.mediaDevices
        .getUserMedia(constraints)
        .then((stream) => {
          webcamRef.current!.srcObject = stream;
          webcamRef.current!.play();

          setWebcamDetectedKeypoints([]);
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
        // Ensure landmarks is an array before filtering
        if (!Array.isArray(landmarks)) {
          console.error("Landmarks is not an array:", landmarks);
          continue; // Skip this iteration
        }

/*         // START: Separate landmarks into left, right, and neutral
        const leftLandmarks = landmarks.filter((_, index) =>
          leftSideIndices.includes(index)
        );
        drawingUtils.drawLandmarks(leftLandmarks, {
          radius: (data) => DrawingUtils.lerp(data.from!.z, -0.15, 0.1, 5, 1),
          color: "rgba(121, 192, 255, 0.7)",
          lineWidth: 1,
        });
        drawingUtils.drawConnectors(landmarks, leftConnections, {
          color: "rgba(121, 192, 255, 0.7)",
          lineWidth: 2,
        });

        const rightLandmarks = landmarks.filter((_, index) =>
          rightSideIndices.includes(index)
        );
        drawingUtils.drawLandmarks(rightLandmarks, {
          radius: (data) => DrawingUtils.lerp(data.from!.z, -0.15, 0.1, 5, 1),
          color: "rgba(242, 165, 88, 0.7)",
          lineWidth: 1,
        });
        drawingUtils.drawConnectors(landmarks, rightConnections, {
          color: "rgba(242, 165, 88, 0.7)",
          lineWidth: 2,
        });

        const neutralLandmarks = landmarks.filter(
          (_, index) =>
            !leftSideIndices.includes(index) &&
            !rightSideIndices.includes(index)
        );
        drawingUtils.drawLandmarks(neutralLandmarks, {
          radius: (data) => DrawingUtils.lerp(data.from!.z, -0.15, 0.1, 5, 1),
          color: "#fff",
          lineWidth: 1,
        });
        drawingUtils.drawConnectors(landmarks, neutralConnections, {
          color: "#fff",
          lineWidth: 2,
        });
        // END: Separate landmarks into left, right, and neutral */

        drawingUtils.drawLandmarks(landmarks, {
          radius: (data) => DrawingUtils.lerp(data.from!.z, -0.15, 0.1, 5, 1),
          color: "#fff",
          lineWidth: 2,
        });
        drawingUtils.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, {
          color: "rgba(242, 165, 88, 0.7)",
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
      // console.log("video keypoints:", keypoints_data);
      // setVideoDetectedKeypoints((prev) => [...prev, keypoints_data]);
      videoDetectedKeypointsRef.current = [
        ...videoDetectedKeypointsRef.current,
        keypoints_data,
      ];
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

        // Draw video skeleton (blue, semi-transparent) using matching frame_id
        let skeletonKeypoint = videoDetectedKeypointsRef.current.find(
          (k) => k.frame_id == frame_id
        );

        if (skeletonKeypoint && skeletonKeypoint.kpts.length > 0) {
          const landmarks = skeletonKeypoint.kpts.map((kpt: any) => ({
            x: kpt.normalized_coords[0],
            y: kpt.normalized_coords[1],
            z: kpt.normalized_coords[2],
            visibility: kpt.visibility,
          }));
          // console.log("skeleton landmarks:", landmarks);
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

        let distances: { [kpt_id: number]: number } = {}; // Store distances per keypoint ID

        for (const landmarks of webcamResult.landmarks) {
          // Ensure landmarks is an array before filtering
          if (!Array.isArray(landmarks)) {
            console.error("Landmarks is not an array:", landmarks);
            continue; // Skip this iteration
          }

          drawingUtils.drawLandmarks(landmarks, {
            radius: (data) => DrawingUtils.lerp(data.from!.z, -0.15, 0.1, 5, 1),
            color: "#fff",
            lineWidth: 2,
          });
          drawingUtils.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, {
            color: "rgba(121, 192, 255, 0.7)",
            lineWidth: 2,
          });

          /* // START: Separate landmarks into left, right, and neutral
          const leftLandmarks = landmarks.filter((_, index) =>
            leftSideIndices.includes(index)
          );
          drawingUtils.drawLandmarks(leftLandmarks, {
            radius: (data) => DrawingUtils.lerp(data.from!.z, -0.15, 0.1, 5, 1),
            color: "rgba(121, 192, 255, 0.7)",
            lineWidth: 1,
          });
          drawingUtils.drawConnectors(landmarks, leftConnections, {
            color: "rgba(121, 192, 255, 0.7)",
            lineWidth: 4,
          });

          const rightLandmarks = landmarks.filter((_, index) =>
            rightSideIndices.includes(index)
          );
          drawingUtils.drawLandmarks(rightLandmarks, {
            radius: (data) => DrawingUtils.lerp(data.from!.z, -0.15, 0.1, 5, 1),
            color: "rgba(242, 165, 88, 0.7)",
            lineWidth: 1,
          });
          drawingUtils.drawConnectors(landmarks, rightConnections, {
            color: "rgba(242, 165, 88, 0.7)",
            lineWidth: 4,
          });

          const neutralLandmarks = landmarks.filter(
            (_, index) =>
              !leftSideIndices.includes(index) &&
              !rightSideIndices.includes(index)
          );
          drawingUtils.drawLandmarks(neutralLandmarks, {
            radius: (data) => DrawingUtils.lerp(data.from!.z, -0.15, 0.1, 5, 1),
            color: "#fff",
            lineWidth: 1,
          });
          drawingUtils.drawConnectors(landmarks, neutralConnections, {
            color: "#fff",
            lineWidth: 2,
          });
          // END: Separate landmarks into left, right, and neutral */

          /* // START: Calculate distances and draw colored dots on the webcam tracking
          if (skeletonKeypoint && skeletonKeypoint.kpts.length > 0) {
            const webcamKpts = webcamResult.landmarks[0];
            const skeletonKpts = skeletonKeypoint.kpts;

            webcamKpts.forEach((webcamKpt: any, index: number) => {
              const skeletonKpt = skeletonKpts.find(
                (kpt: any) => kpt.kpt_id === index
              );
              if (skeletonKpt) {
                const webcamX = webcamKpt.x * webcamRef.current!.videoWidth;
                const webcamY = webcamKpt.y * webcamRef.current!.videoHeight;
                const skeletonX = skeletonKpt.coords[0]; // Already in pixel coords
                const skeletonY = skeletonKpt.coords[1];

                // Calculate Euclidean distance in pixels
                const distance = Math.sqrt(
                  Math.pow(webcamX - skeletonX, 2) +
                    Math.pow(webcamY - skeletonY, 2)
                );
                distances[index] = distance;

                // Draw dot with color based on distance
                const color = distance < 80 ? "rgba(96, 237, 40, 1)" : "rgba(229, 37, 8, 1)";
                canvasCtx.beginPath();
                canvasCtx.arc(webcamX, webcamY, 5, 0, 2 * Math.PI); // 5px radius dot
                canvasCtx.fillStyle = color;
                canvasCtx.fill();
                canvasCtx.closePath();
              }
            });
          } 
          // END: Calculate distances and draw colored dots on the webcam tracking  
          */

          // Calculate distances and draw dots on skeleton keypoints
          const skeletonKpts = skeletonKeypoint ? skeletonKeypoint.kpts : [];

          if (skeletonKpts.length > 0) {
            skeletonKpts.forEach((skeletonKpt: any) => {
              const skeletonX = skeletonKpt.coords[0]; // Pixel coords from predictVideo
              const skeletonY = skeletonKpt.coords[1];
              const kptId = skeletonKpt.kpt_id;

              // Find matching webcam keypoint
              const webcamKptRaw = webcamResult.landmarks[0][kptId]; // Direct index access
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

              // Draw dot on skeleton keypoint
              const color =
                distance < 80 ? "rgba(96, 237, 40, 1)" : "rgba(229, 37, 8, 1)";
              canvasCtx.beginPath();
              canvasCtx.arc(skeletonX, skeletonY, 5, 0, 2 * Math.PI); // skeletonKpt.normalized_coords[0] * webcamRef.current!.videoWidth, skeletonKpt.normalized_coords[1] *
              webcamRef.current!.videoHeight, (canvasCtx.fillStyle = color);
              canvasCtx.fill();
              canvasCtx.closePath();
            });
          }
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
                  normalized_coords: [landmark.x, landmark.y, landmark.z],
                  coords: [
                    landmark.x * webcamRef.current!.videoWidth,
                    landmark.y * webcamRef.current!.videoHeight,
                    landmark.z,
                  ],
                  visibility: landmark.visibility,
                  skeleton_normalized_coords: skeletonKeypoint.kpts.find(
                    (kpt: any) => kpt.kpt_id === index
                  )
                    ? skeletonKeypoint.kpts.find(
                        (kpt: any) => kpt.kpt_id === index
                      ).normalized_coords
                    : null,
                  skeleton_coords: skeletonKeypoint.kpts.find(
                    (kpt: any) => kpt.kpt_id === index
                  )
                    ? skeletonKeypoint.kpts.find(
                        (kpt: any) => kpt.kpt_id === index
                      ).coords
                    : null,
                  distance: distances[index] || null,
                }))
              : [],
          // skeleton_keypoints: skeletonKeypoint ? skeletonKeypoint.kpts : null,
          // distances: distances,
        };
        // console.log("webcam keypoints:", keypoints_data);
        // setWebcamDetectedKeypoints((prev) => [...prev, keypoints_data]);
        webcamDetectedKeypointsRef.current = [
          ...webcamDetectedKeypointsRef.current,
          keypoints_data,
        ];
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
        // setupVideo();
        // setupWebcam();

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
        // resume
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

  // Centralized loading logic
  useEffect(() => {
    setIsLoading(true);
    const initialize = async () => {
      try {
        // 1. Handle video URL
        if (!decodedVideoUrl) throw new Error("No video URL provided");

        // 2. Initialize PoseLandmarkers
        if (!videoPoseLandmarker && !webcamPoseLandmarker) {
          console.log("Initializing PoseLandmarkers...");
          const [videoLandmarker, webcamLandmarker] = await Promise.all([
            createPoseLandmarker("video"),
            createPoseLandmarker("webcam"),
          ]);
        }

        // 3. Get webcam devices and set initial device ID
        await getWebcamDevices();

        // 4. Setup video and webcam
        console.log("Setting up video and webcam...");
        await Promise.all([
          setupVideo(), // Setup video
          // setupWebcam(), // Setup webcam
        ]);

        setIsLoading(false); // All dependencies are ready
      } catch (err: any) {
        console.error("Initialization error:", err);
        setError(err.message);
        if (err.message.includes("Blob URL expired or invalid")) {
          router.push("/");
        }
        setIsLoading(false); // Show error state even if loading fails
      }
    };

    setTimeout(() => {
      initialize();
    }, 1000);

    return () => {
      if (videoRafIdRef.current) cancelAnimationFrame(videoRafIdRef.current);
      if (webcamRafIdRef.current) cancelAnimationFrame(webcamRafIdRef.current);
      if (webcamRef.current?.srcObject) {
        (webcamRef.current.srcObject as MediaStream)
          .getTracks()
          .forEach((track) => track.stop());
      }
    };
  }, [decodedVideoUrl]); // Re-run if URL or device ID changes

  useEffect(() => {
    const switchWebcam = async () => {
      setupWebcam();
    };
    switchWebcam();
  }, [selectedDeviceId]);

  // Update decodedVideoUrl when encodedVideoUrl changes
  useEffect(() => {
    if (encodedVideoUrl) {
      const newDecodedUrl = decodeURIComponent(encodedVideoUrl);
      setDecodedVideoUrl(newDecodedUrl);
    }
  }, [encodedVideoUrl]);

  /* useEffect(() => {
    setupWebcam();
  }, [selectedDeviceId]);

  useEffect(() => {
    if (videoPoseLandmarker && webcamPoseLandmarker && decodedVideoUrl) {
      setupVideo();
      setupWebcam();
    }
  }, [videoPoseLandmarker, webcamPoseLandmarker, decodedVideoUrl]);

  useEffect(() => {
    setIsLoading(true);
    if (encodedVideoUrl && videoRef.current) {
      console.log("Video source set to:", decodeURIComponent(encodedVideoUrl));
      setDecodedVideoUrl(decodeURIComponent(encodedVideoUrl));
      videoRef.current.src = decodeURIComponent(encodedVideoUrl);
      videoRef.current
        .play()
        .catch((err) => console.error("Video play error:", err));
    }
    setIsLoading(false);
  }, [encodedVideoUrl, decodedVideoUrl]);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([createPoseLandmarker("video"), createPoseLandmarker("webcam")])
      .then(() => setIsLoading(false))
      .catch((err) =>
        console.error("Error initializing PoseLandmarkers:", err)
      );
    getWebcamDevices();

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
  }, [error]); */

  return (
    <div className="flex justify-center items-start">
      {isLoading ? (
        <div className="w-screen h-screen flex justify-center items-center border-2">
          <PulseLoader
            color={"#181818"}
            loading={isLoading}
            speedMultiplier={0.5}
            size={14}
            aria-label="Loading Spinner"
            data-testid="loader"
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
            // cssOverride={{ display: "block", margin: "0 auto" }}
          />
        </div>
      ) : (
        <div className="w-full h-full mt-5 flex flex-col items-center justify-center gap-2 max-w-[1200px]">
          {/* Video and Webcam display */}
          <div className=" w-full flex items-start justify-center gap-4">
            <div className="relative w-[50%] [box-shadow:rgba(17,_17,_26,_0.1)_0px_4px_16px,_rgba(17,_17,_26,_0.05)_0px_8px_32px] rounded-md">
              <video
                ref={videoRef}
                width={resizedVideoWidth.current} // Bind to state
                height={resizedVideoHeight.current} // Bind to state
                playsInline
                className="rounded-md "
              />
              <canvas
                ref={canvasRef}
                width={resizedVideoWidth.current}
                height={resizedVideoHeight.current}
                className="absolute top-0 left-0 w-full h-full rounded-md"
              />
            </div>
            <div className="relative w-[50%] [box-shadow:rgba(17,_17,_26,_0.1)_0px_4px_16px,_rgba(17,_17,_26,_0.05)_0px_8px_32px] rounded-md">
              <video
                ref={webcamRef}
                width={resizedVideoWidth.current} // Bind to state
                height={resizedVideoHeight.current} // Bind to state
                playsInline
                className="rounded-md"
              />
              <canvas
                ref={webcamCanvasRef}
                width={resizedVideoWidth.current} // Bind to state
                height={resizedVideoHeight.current} // Bind to state
                className="absolute top-0 left-0 w-full h-full rounded-md "
              />
            </div>
          </div>
          {/* Video and Webcam controls */}
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
              <div className="flex justify-start items-center gap-6">
                <p className="text-custom-on-surface-container text-[12px]">
                  Speed:
                </p>
                <ElasticSlider
                  leftIcon={
                    <RiSpeedUpFill className="text-custom-on-surface-container " />
                  }
                  // rightIcon={<>...your icon...</>}
                  startingValue={0}
                  defaultValue={100}
                  maxValue={200}
                  isStepped={false}
                  // stepSize={10}
                  onValueChange={(value) => handleAdjustSpeed(value / 100)}
                />
              </div>
            </div>
            <div className="w-[50%] h-full flex justify-start items-center gap-2">
              {/* <p className="text-custom-on-surface-container">Webcam:</p> */}
              {webcamDevices && (
                <Select
                  value={selectedDeviceId || webcamDevices[0]?.deviceId}
                  onValueChange={(value) => setSelectedDeviceId(value)}
                >
                  <SelectTrigger className="w-[180px] cursor-pointer">
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
          <div className="w-full flex justify-start items-center gap-2 mt-2">
            {/* FPS Chart */}
            <div className="w-[100%]">
              <FpsChart
                videoDetectedKeypointsRef={videoDetectedKeypointsRef}
                webcamDetectedKeypointsRef={webcamDetectedKeypointsRef}
                videoPlaying={videoPlaying}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default page;
