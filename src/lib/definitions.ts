// Define the type for a single keypoint
export type KEYPOINT_TYPE = {
  frame_id: number;
  kpt_id: number;
  normalized_coords: number[];
  coords: number[];
  visibility: number;
};

// Define the main type for video detected keypoints
export type VIDEO_DETECTED_KEYPOINTS_TYPE = {
  frame_id: number;
  resolution: number[];
  video_timestamp: string;
  fps: string;
  avg_fps: string;
  no_of_poses: number;
  kpts: KEYPOINT_TYPE[];
};

// Define the type for a single keypoint
export type WEBCAM_KEYPOINT_TYPE = {
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
export type WEBCAM_DETECTED_KEYPOINTS_TYPE = {
  frame_id: number;
  resolution: number[];
  webcam_timestamp: number;
  fps: string;
  avg_fps: string;
  no_of_poses: number;
  kpts: WEBCAM_KEYPOINT_TYPE[];
};

// Define the type for a MediaPipe landmark
// export type LANDMARK_TYPE = {
//   x: number;
//   y: number;
//   z: number;
//   visibility?: number;
// };

export interface WorkerMessage {
  type: "process_keypoints" | "clear";
  videoKeypoints?: VIDEO_DETECTED_KEYPOINTS_TYPE[];
  webcamKeypoints?: WEBCAM_DETECTED_KEYPOINTS_TYPE[];
}

export interface WorkerResponse {
  type: "fps_data" | "animation_data";
  data: any;
}