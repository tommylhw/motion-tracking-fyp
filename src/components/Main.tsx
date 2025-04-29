"use client";
import { useEffect, useState } from "react";
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
  const [isLoading, setIsLoading] = useState(false);

  const [file, setFile] = useState<File>();
  // const [encodedVideoUrl, setEncodedVideoUrl] = useState<string | null>(null);

  const handleFileUpload = async (file: File): Promise<void> => {
    setFile(file);
    setIsLoading(true);
    console.log('File uploaded:', file);

    // Use the context to set the video
    await setVideo(file);

    if (videoUrl && encodedVideoUrl && videoBlob && videoName) { 
      // setEncodedVideoUrl(videoUrl);
      console.log("Main.tsx video table");
      console.table({
        'videoBlob': videoBlob,
        'videoUrl': videoUrl,
        'encodedVideoUrl': encodedVideoUrl,
        'videoName': videoName,
      });
    }
  };

  useEffect(() => {
    if (videoUrl && encodedVideoUrl && videoBlob && videoName) {
      console.log("Video ready in IndexedDB");
      console.table({
        'videoBlob': videoBlob,
        'videoUrl': videoUrl,
        'encodedVideoUrl': encodedVideoUrl,
        'videoName': videoName,
      });
      setIsLoading(false);
    }
  }, [encodedVideoUrl])

  return (
    <div className="flex flex-col items-center justify-center w-full h-full">
      <FileUpload onChange={handleFileUpload} />
      <div className="flex justify-center items-center">
        {!isLoading && file && encodedVideoUrl &&  (
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
