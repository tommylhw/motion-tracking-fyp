"use client";
import { useState, useEffect, useRef } from "react";
import {
  FilesetResolver,
  PoseLandmarker,
  DrawingUtils,
} from "@mediapipe/tasks-vision";

// components
import WebcamTracking from "./components/WebcamTracking";
import VideoTracking from "./components/VideoTracking";
import Main from "./components/Main";

export default function Home() {
  return (
    <div className="flex justify-center items-center w-screen h-screen">
      {/* <WebcamTracking />
      <VideoTracking /> */}
      <Main />
    </div>
  );
}
