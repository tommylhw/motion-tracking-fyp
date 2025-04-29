import React from "react";

// component
import Playground from "@/components/Playground";

export async function generateStaticParams() {
  // Replace this with your logic to fetch possible video IDs
  const videos = ["video1", "video2", "video3"]; // Example: list of video IDs

  return videos.map((video) => ({
    video: [video], // Maps to the [video] dynamic segment
  }));
}

const Page = async ({ params }: { params: Promise<{ video: string }> }) => {
  const { video } = await params;
  return (
    <div>{video[0]}</div>
  );
};

export default Page;
