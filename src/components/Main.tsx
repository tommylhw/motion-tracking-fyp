"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// ui
import { FileUpload } from "@/components/ui/file-upload";
import { Button } from "@/components/ui/button";

// redux toolkit
// import { useDispatch } from "react-redux";

// context
import { useVideo } from "@/context/VideoContext";

const Main = () => {
  const router = useRouter();
  // const dispatch = useDispatch();
  const { setVideo, videoUrl, encodedVideoUrl, videoBlob, videoName } = useVideo();

  const [file, setFile] = useState<File>();
  // const [encodedVideoUrl, setEncodedVideoUrl] = useState<string | null>(null);

  const handleFileUpload = async (file: File): Promise<void> => {
    setFile(file);
    console.log(file);

    // Use the context to set the video
    await setVideo(file);

    if (videoUrl && encodedVideoUrl && videoBlob && videoName) { 
      // setEncodedVideoUrl(videoUrl);
      console.table({
        'videoBlob': videoBlob,
        'videoUrl': videoUrl,
        'encodedVideoUrl': encodedVideoUrl,
        'videoName': videoName,
      });
    }

    // const arrayBuffer = await file.arrayBuffer();
    // dispatch(
    //   setVideo({
    //     data: arrayBuffer,
    //     fileName: file.name,
    //   })
    // );
    // if (file) {
    //   const blob = new Blob([arrayBuffer], { type: file.type });
    //   const url = URL.createObjectURL(blob);
    //   const encodedBlobUrl = encodeURIComponent(url);
    //   setBlobUrl(encodedBlobUrl);
    // }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-full">
      <FileUpload onChange={handleFileUpload} />
      <div className="flex justify-center items-center">
        {file && encodedVideoUrl && (
          <Button
            className=" cursor-pointer"
            onClick={() =>
              encodedVideoUrl && router.push(`/playground/${encodedVideoUrl}`)
            }
          >
            Start Motion Tracking
          </Button>
        )}
      </div>
    </div>
  );
};

export default Main;
