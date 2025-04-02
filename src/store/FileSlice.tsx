import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface VideoState {
  videoData: ArrayBuffer | null; // Store the raw file data
  fileName: string | null; // Optional: Store file name for reference
}

const initialState: VideoState = {
  videoData: null,
  fileName: null,
};

const fileSlice = createSlice({
  name: "file",
  initialState,
  reducers: {
    setVideo: (
      state,
      action: PayloadAction<{ data: ArrayBuffer; fileName: string }>
    ) => {
      state.videoData = action.payload.data;
      state.fileName = action.payload.fileName;
    },
    clearVideo: (state) => {
      state.videoData = null;
      state.fileName = null;
    },
  },
});

export const { setVideo, clearVideo } = fileSlice.actions;
export const selectVideoData = (state: { file: VideoState }) =>
  state.file.videoData;
export const selectFileName = (state: { file: VideoState }) =>
  state.file.fileName;
export default fileSlice.reducer;
