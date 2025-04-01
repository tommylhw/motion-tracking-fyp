"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FilesetResolver,
  PoseLandmarker,
  DrawingUtils,
} from "@mediapipe/tasks-vision";

// ui
import { FileUpload } from "@/components/ui/file-upload";
import { Button } from "@/components/ui/button";

// components

const Main = () => {
  const router = useRouter();
  const [file, setFile] = useState<File>();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  const handleFileUpload = (file: File) => {
    setFile(file);
    console.log(file);

    if (file) {
      const url = URL.createObjectURL(file);
      const encodedBlobUrl = encodeURIComponent(url);
      setBlobUrl(encodedBlobUrl);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-full">
      <FileUpload onChange={handleFileUpload} />
      <div className="flex justify-center items-center">
        {file && blobUrl && (
          <Button
            className=" cursor-pointer"
            onClick={() => blobUrl && router.push(`/playground/${blobUrl}`)}
          >
            Start Motion Tracking
          </Button>
        )}
      </div>
    </div>
  );
};

export default Main;
