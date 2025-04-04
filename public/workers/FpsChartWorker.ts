self.onmessage = (event: MessageEvent) => {
  const { videoData, webcamData } = event.data;
  const maxFrames = Math.max(videoData.length, webcamData.length);
  const newChartData = Array.from({ length: maxFrames }, (_, index) => {
    const videoFps = videoData[index]?.fps ? parseFloat(videoData[index].fps) : null;
    const webcamFps = webcamData[index]?.fps ? parseFloat(webcamData[index].fps) : null;
    return { frame_id: index, video: videoFps, webcam: webcamFps };
  });
  self.postMessage(newChartData);
};