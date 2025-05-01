// keypoints.worker.ts
import {
  VIDEO_DETECTED_KEYPOINTS_TYPE,
  WEBCAM_DETECTED_KEYPOINTS_TYPE,
  WorkerMessage,
  WorkerResponse,
} from "../../src/lib/definitions";

// Define the type for a single keypoint
// type KEYPOINT_TYPE = {
//   frame_id: number;
//   kpt_id: number;
//   normalized_coords: number[];
//   coords: number[];
//   visibility: number;
// };

// // Define the main type for video detected keypoints
// type VIDEO_DETECTED_KEYPOINTS_TYPE = {
//   frame_id: number;
//   resolution: number[];
//   video_timestamp: string;
//   fps: string;
//   avg_fps: string;
//   no_of_poses: number;
//   kpts: KEYPOINT_TYPE[];
// };

// // Define the type for a single keypoint
// type WEBCAM_KEYPOINT_TYPE = {
//   frame_id: number;
//   kpt_id: number;
//   normalized_coords: number[];
//   coords: number[];
//   visibility: number;
//   skeleton_normalized_coords: number[] | null;
//   skeleton_coords: number[] | null;
//   distance: number | null;
// };

// // Define the main type for webcam detected keypoints
// type WEBCAM_DETECTED_KEYPOINTS_TYPE = {
//   frame_id: number;
//   resolution: number[];
//   webcam_timestamp: number;
//   fps: string;
//   avg_fps: string;
//   no_of_poses: number;
//   kpts: WEBCAM_KEYPOINT_TYPE[];
// };

// interface WorkerMessage {
//   type: "process_keypoints" | "clear";
//   videoKeypoints?: VIDEO_DETECTED_KEYPOINTS_TYPE[];
//   webcamKeypoints?: WEBCAM_DETECTED_KEYPOINTS_TYPE[];
// }

// interface WorkerResponse {
//   type: "fps_data" | "animation_data";
//   data: any;
// }

const MAX_FRAMES = 1000; // Sliding window size
let videoKeypoints: VIDEO_DETECTED_KEYPOINTS_TYPE[] = [];
let webcamKeypoints: WEBCAM_DETECTED_KEYPOINTS_TYPE[] = [];

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { type, videoKeypoints: newVideoKeypoints, webcamKeypoints: newWebcamKeypoints } = e.data;

  if (type === "clear") {
    videoKeypoints = [];
    webcamKeypoints = [];
    return;
  }

  if (newVideoKeypoints) {
    newVideoKeypoints.forEach((keypoint) => {
      const prevAvgFps = videoKeypoints.length > 0 ? parseFloat(videoKeypoints[videoKeypoints.length - 1].avg_fps) : 0;
      const frameCount = keypoint.frame_id + 1;
      const fps = parseFloat(keypoint.fps);
      const avg_fps = frameCount === 1 ? fps : prevAvgFps + (fps - prevAvgFps) / frameCount;
      videoKeypoints.push({ ...keypoint, avg_fps: avg_fps.toFixed(2) });
    });
    videoKeypoints = videoKeypoints.slice(-MAX_FRAMES);
  }

  if (newWebcamKeypoints) {
    newWebcamKeypoints.forEach((keypoint) => {
      const prevAvgFps = webcamKeypoints.length > 0 ? parseFloat(webcamKeypoints[webcamKeypoints.length - 1].avg_fps) : 0;
      const frameCount = keypoint.frame_id + 1;
      const fps = parseFloat(keypoint.fps);
      const avg_fps = frameCount === 1 ? fps : prevAvgFps + (fps - prevAvgFps) / frameCount;
      webcamKeypoints.push({ ...keypoint, avg_fps: avg_fps.toFixed(2) });
    });
    webcamKeypoints = webcamKeypoints.slice(-MAX_FRAMES);
  }

  const maxFrames = Math.max(videoKeypoints.length, webcamKeypoints.length);
  const fpsData = Array.from({ length: maxFrames }, (_, index) => ({
    frame_id: index,
    video: videoKeypoints[index]?.fps ? parseFloat(videoKeypoints[index].fps) : null,
    webcam: webcamKeypoints[index]?.fps ? parseFloat(webcamKeypoints[index].fps) : null,
    video_avg_fps: videoKeypoints[index]?.avg_fps ? parseFloat(videoKeypoints[index].avg_fps) : null,
    webcam_avg_fps: webcamKeypoints[index]?.avg_fps ? parseFloat(webcamKeypoints[index].avg_fps) : null,
  }));

  const animationData = videoKeypoints[videoKeypoints.length - 1] || null;

  self.postMessage({
    type: "fps_data",
    data: fpsData,
  } as WorkerResponse);

  self.postMessage({
    type: "animation_data",
    data: animationData,
  } as WorkerResponse);
};