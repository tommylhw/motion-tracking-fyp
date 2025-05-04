"use client";
import React, { useRef, useEffect } from "react";
import { animate } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { eventEmitter } from "@/utils/eventEmitter";

// Define the type for a single keypoint (same as in page.tsx)
type KEYPOINT_TYPE = {
  frame_id: number;
  kpt_id: number;
  normalized_coords: number[];
  coords: number[];
  visibility: number;
};

// Define the main type for video detected keypoints (same as in page.tsx)
type VIDEO_DETECTED_KEYPOINTS_TYPE = {
  frame_id: number;
  resolution: number[];
  video_timestamp: string;
  fps: string;
  avg_fps: string;
  no_of_poses: number;
  kpts: KEYPOINT_TYPE[];
};

// Props type for the ThinkingAnimation component
interface ThinkingAnimationProps {
  isThinking: boolean;
}

export default function ThinkingAnimation({
  isThinking,
}: ThinkingAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationDataRef = useRef<VIDEO_DETECTED_KEYPOINTS_TYPE | null>(null);

  useEffect(() => {
    const handleAnimationData = (
      data: VIDEO_DETECTED_KEYPOINTS_TYPE | null
    ) => {
      animationDataRef.current = data;
    };
    eventEmitter.on("animation_data", handleAnimationData);
    return () => eventEmitter.off("animation_data", handleAnimationData);
  }, []);

  useEffect(() => {
    if (!canvasRef.current || !isThinking) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const keypoints = animationDataRef.current;

      if (keypoints && keypoints.kpts.length > 0) {
        ctx.beginPath();
        keypoints.kpts.forEach((kpt) => {
          const x = kpt.normalized_coords[0] * canvas.width;
          const y = kpt.normalized_coords[1] * canvas.height;
          ctx.arc(x, y, 5, 0, 2 * Math.PI);
          ctx.fillStyle = "rgba(242, 165, 88, 0.7)";
          ctx.fill();
        });
        ctx.closePath();
      }

      if (isThinking) {
        requestAnimationFrame(draw);
      }
    };

    if (isThinking) {
      draw();
    }

    return () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [isThinking]);

  return (
    <Card className="border-0 shadow-(--shadow-custom-neuromorphic)">
      <CardHeader>
        <CardTitle>Thinking Animation</CardTitle>
        <CardDescription>
          Visualizing pose keypoints in real-time
        </CardDescription>
      </CardHeader>
      <CardContent>
        <canvas
          ref={canvasRef}
          width={400}
          height={300}
          className="w-full h-auto"
          />
      </CardContent>
    </Card>
  );
}
