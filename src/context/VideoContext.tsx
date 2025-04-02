import React, { createContext, useContext, useState, useEffect } from "react";

// Define types for the video data
interface VideoState {
  videoBlob: Blob | null;
  videoUrl: string | null;
  encodedVideoUrl: string | null;
  videoName: string | null;
}

interface VideoContextValue extends VideoState {
  setVideo: (file: File) => Promise<void>;
}

// IndexedDB helpers with TypeScript
const openDB = (): Promise<IDBDatabase> =>
  new Promise((resolve) => {
    const request = indexedDB.open("videoDB", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("videos");
    request.onsuccess = () => resolve(request.result);
  });

  const storeBlob = async (blob: Blob): Promise<void> => {
    const db = await openDB();
    const tx = db.transaction('videos', 'readwrite');
    const store = tx.objectStore('videos');
    store.put(blob, 'currentVideo');
    return new Promise((resolve) => {
      tx.oncomplete = (_ev: Event) => resolve(); // Explicitly type the event and ignore it
    });
  };

const getBlob = async (): Promise<Blob | undefined> => {
  const db = await openDB();
  const tx = db.transaction("videos", "readonly");
  const store = tx.objectStore("videos");
  return new Promise((resolve) => {
    const request = store.get("currentVideo");
    request.onsuccess = () => resolve(request.result as Blob | undefined);
  });
};

// Create the Context
const VideoContext = createContext<VideoContextValue | undefined>(undefined);

export const VideoProvider = ({ children }: { children: React.ReactNode }) => {
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [encodedVideoUrl, setEncodedVideoUrl] = useState<string | null>(null);
  const [videoName, setVideoName] = useState<string | null>(null);

  // Load persisted Blob from IndexedDB on mount
  useEffect(() => {
    getBlob().then((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const encodedUrl = encodeURIComponent(url);
        setEncodedVideoUrl(encodedUrl);
        setVideoBlob(blob);
        setVideoUrl(url);
        setVideoName("restored");
      }
    });

    console.table({
      'videoBlob': videoBlob,
      'videoUrl': videoUrl,
      'encodedVideoUrl': encodedVideoUrl,
      'videoName': videoName,
    });
  }, []);

  // Set video and persist to IndexedDB
  const setVideo = async (file: File): Promise<void> => {
    const blob = new Blob([file], { type: file.type });
    const url = URL.createObjectURL(blob);
    const encodedUrl = encodeURIComponent(url);
    setEncodedVideoUrl(encodedUrl);
    setVideoBlob(blob);
    setVideoUrl(url);
    setVideoName(file.name);
    await storeBlob(blob); // Persist to IndexedDB
  };

  const value: VideoContextValue = { videoBlob, videoUrl, encodedVideoUrl, videoName, setVideo };

  return (
    <VideoContext.Provider value={value}>{children}</VideoContext.Provider>
  );
};

// Custom hook to use the context with type safety
export const useVideo = (): VideoContextValue => {
  const context = useContext(VideoContext);
  if (!context) {
    throw new Error('useVideo must be used within a VideoProvider');
  }
  return context;
};