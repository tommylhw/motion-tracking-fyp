"use client";

import { useEffect, useRef } from "react";
// import { TrendingUp } from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { NameType, Payload, ValueType } from "recharts/types/component/DefaultTooltipContent";

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

// Define the type for a single keypoint
type WEBCAM_KEYPOINT_TYPE = {
  frame_id: number;
  kpt_id: number;
  normalized_coords: number[];
  coords: number[];
  visibility: number;
  skeleton_normalized_coords: number[] | null;
  skeleton_coords: number[] | null;
  distance: number | null;
};

// Define the main type for webcam detected keypoints
type WEBCAM_DETECTED_KEYPOINTS_TYPE = {
  frame_id: number;
  resolution: number[];
  webcam_timestamp: number;
  fps: string;
  avg_fps: string;
  no_of_poses: number;
  kpts: WEBCAM_KEYPOINT_TYPE[];
};

// Custom type for the Payload to override the 'payload' property, keeping TValue and TName generic
interface CustomPayload<TValue extends ValueType, TName extends NameType>
  extends Payload<TValue, TName> {
  payload?: VIDEO_DETECTED_KEYPOINTS_TYPE;
}

// Custom label formatter for the tooltip title, made generic
const tooltipLabelFormatter = <TValue extends ValueType, TName extends NameType>(
  label: string | number, // Avoid using 'any'
  payload: CustomPayload<TValue, TName>[]
): React.ReactNode => {
  const frameId = payload[0]?.payload?.frame_id; // Get frame_id from the first payload item
  return frameId !== undefined ? `Frame ${frameId}` : "Frame N/A"; // Custom title format with fallback
};

// Chart configuration
const chartConfig = {
  video: {
    label: "Video FPS",
    color: "hsl(var(--chart-1))",
  },
  webcam: {
    label: "Webcam FPS",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

export function FpsChart({
  videoDetectedKeypointsRef,
  webcamDetectedKeypointsRef,
  videoPlaying,
}: {
  videoDetectedKeypointsRef: React.RefObject<VIDEO_DETECTED_KEYPOINTS_TYPE[]>;
  webcamDetectedKeypointsRef: React.RefObject<WEBCAM_DETECTED_KEYPOINTS_TYPE[]>;
  videoPlaying: boolean;
}) {
  // const [chartData, setChartData] = useState<
  //   { frame_id: number | null; video: number | null; webcam: number | null }[]
  // >([]);
  
  const scrollRef = useRef<HTMLDivElement>(null); // Ref for the scrollable div
  // const workerRef = useRef<Worker | null>(null);

  const chartDataRef = useRef<{ frame_id: number; video: number | null; webcam: number | null }[]>([]);
  const rafIdRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const UPDATE_INTERVAL = 100; // Update every 100ms (~10 FPS) for smooth

  const updateChartData = () => {
    const videoData = videoDetectedKeypointsRef.current || [];
    const webcamData = webcamDetectedKeypointsRef.current || [];
    const maxFrames = Math.max(videoData.length, webcamData.length);

    // Only update if data has grown since last update
    if (maxFrames > chartDataRef.current.length) {
      const newChartData = Array.from({ length: maxFrames }, (_, index) => ({
        frame_id: index,
        video: videoData[index]?.fps ? parseFloat(videoData[index].fps) : null,
        webcam: webcamData[index]?.fps ? parseFloat(webcamData[index].fps) : null,
      }));
      chartDataRef.current = newChartData;
    }

    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth; // Auto-scroll to latest data
    }
  };

  const animate = (timestamp: number) => {
    if (!videoPlaying) {
      rafIdRef.current = null;
      return;
    }

    // Throttle updates to ~10 FPS for smoothness without overloading
    if (timestamp - lastUpdateRef.current >= UPDATE_INTERVAL) {
      updateChartData();
      lastUpdateRef.current = timestamp;
    }

    rafIdRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    if (videoPlaying && !rafIdRef.current) {
      lastUpdateRef.current = performance.now();
      rafIdRef.current = requestAnimationFrame(animate);
    } else if (!videoPlaying && rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [videoPlaying]);

  // // Force re-render periodically only when data changes significantly
  // const [, forceUpdate] = useRef(0); // Dummy state to trigger re-render
  // useEffect(() => {
  //   const renderInterval = setInterval(() => {
  //     if (videoPlaying && chartDataRef.current.length > 0) {
  //       forceUpdate((prev) => prev + 1); // Trigger re-render every 100ms if data exists
  //     }
  //   }, UPDATE_INTERVAL);

  //   return () => clearInterval(renderInterval);
  // }, [videoPlaying]);

  const chartWidth = Math.max(chartDataRef.current.length * 10, 800);

  /* // Update chart data on useeffect interval, but only if video is playing
  useEffect(() => {
    const updateChartData = () => {
      const videoData = videoDetectedKeypointsRef.current;
      const webcamData = webcamDetectedKeypointsRef.current;

      // Merge data by frame_id, ensuring both video and webcam FPS are included
      const maxFrames = Math.max(videoData.length, webcamData.length);
      const newChartData = Array.from({ length: maxFrames }, (_, index) => {
        const videoFps = videoData[index]?.fps
          ? parseFloat(videoData[index].fps)
          : null;
        const webcamFps = webcamData[index]?.fps
          ? parseFloat(webcamData[index].fps)
          : null;

        // Log FPS values for debugging
        // if (videoFps !== null) console.log(`Frame ${index} - Video FPS: ${videoFps}`);
        // if (webcamFps !== null) console.log(`Frame ${index} - Webcam FPS: ${webcamFps}`);

        return {
          frame_id: index,
          video: videoFps,
          webcam: webcamFps,
        };
      });

      setChartData(newChartData);
    };

    // Initial update when component mounts
    updateChartData();

    let interval: NodeJS.Timeout | null = null;
    // Start polling only if video is playing
    if (videoPlaying) {
      interval = setInterval(updateChartData, 2000);
      // updateChartData();
    }
    // Cleanup
    return () => {
      if (interval) clearInterval(interval);
      // workerRef.current?.terminate(); // Terminate worker on unmount
    };
  }, [videoDetectedKeypointsRef, webcamDetectedKeypointsRef, videoPlaying]);

  // Scroll to the right whenever chartData updates
  useEffect(() => {
    const scrollDiv = scrollRef.current;
    if (scrollDiv) {
      scrollDiv.scrollLeft = scrollDiv.scrollWidth; // Scroll to the far right
    }
  }, [chartData]); // Trigger when chartData changes

  // Dynamic width: 10px per frame, minimum 800px
  const chartWidth = Math.max(chartData.length * 10, parseInt('100%', 10)); */


  // // Custom label formatter for the tooltip title
  // const tooltipLabelFormatter = (value: string | number, payload: CustomPayload[]) => {
  //   const frameId = payload[0]?.payload?.frame_id; // Get frame_id from the first payload item
  //   return `Frame ${frameId}`; // Custom title format
  // };

  return (
    <Card className="border-0 shadow-(--shadow-custom-neuromorphic)">
      <CardHeader>
        <CardTitle>FPS Over Time</CardTitle>
        <CardDescription>
          Visualize the FPS data over time for both video and webcam streams.
        </CardDescription>
      </CardHeader>
      <div className="px-[20px] flex">
        {/* Fixed Y-Axis Container */}
        {/* <div className="flex-shrink-0 border-1" style={{ width: "60px", height: "280px" }}>
          <ChartContainer config={chartConfig}>
            <LineChart data={chartData} width={60} height={280} margin={{ left: 12, right: 0, top: 10, bottom: 10 }}>
              <YAxis
                domain={[0, 60]}
                tickCount={7}
                label={{ value: "FPS", angle: -90, position: "insideLeft" }}
                width={60} // Match container width
                height={280}
              />
            </LineChart>
          </ChartContainer>
        </div> */}
        <CardContent className="overflow-x-scroll h-[300px] w-full" ref={scrollRef}>
          {" "}
          {/* handle overflow x */}
          <ChartContainer
            config={chartConfig}
            style={{
              height: "280px",
              width: `${chartWidth}px`, // Set explicit width for the chart container
            }}
          >
            <LineChart
              accessibilityLayer
              // data={chartData}
              data={chartDataRef.current} // Use the ref for chart data
              margin={{ left: 12, right: 12, top: 10, bottom: 10 }}
              width={chartWidth} // Explicitly set width
              height={280} // Fixed height for the chart
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="frame_id"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                label={{
                  value: "Frame ID",
                  position: "insideBottom",
                  offset: -10,
                }}
                // interval={Math.floor(chartData.length / 10) || 1} // Dynamic tick interval
              />
              <YAxis
                domain={[0, 60]} // Reasonable FPS range
                tickCount={7} // Approx 10-unit intervals (0, 10, 20, 30, 40, 50, 60)
                label={{ value: "FPS", angle: -90, position: "insideLeft" }}
              />
              <ChartTooltip
                cursor={true}
                content={
                  <ChartTooltipContent labelFormatter={tooltipLabelFormatter} />
                }
              />
              <Line
                dataKey="video"
                type="natural"
                stroke="var(--color-custom-secondary)" // Match your theme
                strokeWidth={2}
                dot={false}
                name="Video FPS"
              />
              <Line
                dataKey="webcam"
                type="natural"
                stroke="var(--color-custom-primary)" // Match your theme
                strokeWidth={2}
                dot={false}
                name="Webcam FPS"
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </div>
      <CardFooter>
        <div className="flex w-full items-start gap-2 text-sm">
          <div className="flex justify-between gap-2 w-full">
            <div className="flex flex-col items-start gap-2 font-medium leading-none">
              <p>Average Video Tracking FPS: {videoDetectedKeypointsRef.current[videoDetectedKeypointsRef.current?.length - 1]?.avg_fps}</p>
              <p>Average Real-time Tracking FPS: {webcamDetectedKeypointsRef.current[webcamDetectedKeypointsRef.current?.length - 1]?.avg_fps}</p>
            </div>
            <div className="flex items-center gap-2 leading-none text-muted-foreground">
              Frame ID range: 0 - {videoDetectedKeypointsRef.current[videoDetectedKeypointsRef.current?.length - 1]?.frame_id}
              {/* Frame ID range: 0 - {chartDataRef.current.length - 1 || 0} */}
            </div>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
