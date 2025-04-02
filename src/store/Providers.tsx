"use client";
import React from "react";
import { Provider } from "react-redux";
import store from "./store";
import { VideoProvider } from "@/context/VideoContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <VideoProvider>{children}</VideoProvider>
    </Provider>
  );
}
