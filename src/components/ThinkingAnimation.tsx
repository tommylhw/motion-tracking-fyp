"use client";
import React, { useRef, useEffect } from "react";
import { animate } from "framer-motion";

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
  updateKeypoints: (callback: (keypoints: VIDEO_DETECTED_KEYPOINTS_TYPE[]) => void) => void;
}

const ThinkingAnimation: React.FC<ThinkingAnimationProps> = ({
  isThinking,
  updateKeypoints,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastFrameIdRef = useRef<number>(-1); // Track the last frame ID processed
  const rafIdRef = useRef<number | null>(null); // Track the requestAnimationFrame ID
  const lastTimestampRef = useRef<number>(performance.now()); // Track the last timestamp for scrolling

  // Animation function to animate a new element
  const animateElement = (element: HTMLElement) => {
    animate(element, {
      opacity: [0, 1],
      y: [20, 0],
    }, {
      duration: 0.5,
      ease: "easeOut",
    });
  };

  // Function to append a new keypoint item to the container
  const appendKeypoint = (item: VIDEO_DETECTED_KEYPOINTS_TYPE) => {
    if (!containerRef.current) return;

    // console.log(`Appending keypoint for frame ${item.frame_id}`);

    const newElement = document.createElement("div");
    newElement.className = "p-2 bg-gray-700 text-white rounded-md";

    // Create a <pre> element to display the formatted JSON
    const preElement = document.createElement("pre");
    preElement.className = "text-sm whitespace-pre-wrap break-words";
    preElement.textContent = JSON.stringify(item, null, 2);

    newElement.appendChild(preElement);
    containerRef.current.appendChild(newElement);

    // Animate the new element
    animateElement(newElement);

    // Scroll to the bottom to show the latest item
    // containerRef.current.scrollTop = containerRef.current.scrollHeight;
  };

  // Smooth scrolling animation at a constant speed
  const scrollSpeed = 80; // Pixels per second
  const scrollContainer = () => {
    if (!containerRef.current) return;

    const now = performance.now();
    const deltaTime = (now - lastTimestampRef.current) / 1000; // Time in seconds
    lastTimestampRef.current = now;

    // Calculate the scroll increment based on speed and time elapsed
    const scrollIncrement = scrollSpeed * deltaTime;
    containerRef.current.scrollTop += scrollIncrement;

    // Stop scrolling if we've reached the bottom
    const isAtBottom =
      containerRef.current.scrollTop + containerRef.current.clientHeight >=
      containerRef.current.scrollHeight;

    if (!isAtBottom && isThinking) {
      rafIdRef.current = requestAnimationFrame(scrollContainer);
    } else {
      rafIdRef.current = null;
    }
  };

  // Start or stop the scrolling animation based on isThinking
  useEffect(() => {
    if (isThinking) {
      lastTimestampRef.current = performance.now();
      if (!rafIdRef.current) {
        rafIdRef.current = requestAnimationFrame(scrollContainer);
      }
    } else {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      // if (containerRef.current) {
      //   console.log("Clearing container because isThinking is false");
      //   containerRef.current.innerHTML = "";
      // }
      // lastFrameIdRef.current = -1; // Reset the last frame ID
    }

    // Cleanup on unmount
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [isThinking]);

  // Update function that will be called by the parent
  useEffect(() => {
    updateKeypoints((keypoints: VIDEO_DETECTED_KEYPOINTS_TYPE[]) => {
      // console.log(`updateKeypoints called with ${keypoints.length} items, isThinking: ${isThinking}`);

      if (!isThinking) return;

      // Process only new keypoints
      const newItems = keypoints.filter(item => item.frame_id > lastFrameIdRef.current);
      // console.log(`Found ${newItems.length} new items to process`);
      if (newItems.length > 0) {
        newItems.forEach(item => {
          appendKeypoint(item);
          lastFrameIdRef.current = item.frame_id;
        });
      }
    });
  }, [isThinking]);

  return (
    <div className="w-full mx-auto mt-4 p-4 bg-gray-800 rounded-lg">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-white">Processing Keypoints...</h3>
          <div
            ref={containerRef}
            className="space-y-2 max-h-[300px] overflow-y-auto " // [mask-image:linear-gradient(to_bottom,transparent_0%,rgba(30,42,56,1)_10%,rgba(30,42,56,1)_90%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,transparent_0%,rgba(30,42,56,1)_10%,rgba(30,42,56,1)_90%,transparent_100%)]
          />
        </div>
    </div>
  );
};

export default ThinkingAnimation;