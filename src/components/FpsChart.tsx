"use client";

import { useEffect, useState, useRef } from "react";
import { TrendingUp } from "lucide-react";
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
  frameCountRef,
  frameCount,
}: {
  videoDetectedKeypointsRef: React.RefObject<any[]>;
  webcamDetectedKeypointsRef: React.RefObject<any[]>;
  videoPlaying: boolean;
  frameCountRef?: React.RefObject<number>;
  frameCount?: number;
}) {
  const [chartData, setChartData] = useState<
    { frame_id: number | null; video: number | null; webcam: number | null }[]
  >([]);
  const scrollRef = useRef<HTMLDivElement>(null); // Ref for the scrollable div
  const workerRef = useRef<Worker | null>(null);

  // Update chart data whenever keypoints change, but only if video is playing
  useEffect(() => {
    /* // Initialize Web Worker
    workerRef.current = new Worker(
      new URL("/workers/FpsChartWorker.ts", import.meta.url),
      {
        type: "module", // Required for ES modules in some environments
      }
    );

    // Handle messages from the worker
    workerRef.current.onmessage = (event: MessageEvent) => {
      setChartData(event.data);
    };

    // Function to send data to worker
    const updateChartData = () => {
      const videoData = videoDetectedKeypointsRef.current || [];
      const webcamData = webcamDetectedKeypointsRef.current || [];
      workerRef.current?.postMessage({ videoData, webcamData });
    }; */

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

    /* let interval: NodeJS.Timeout | null = null;
    // Start polling only if video is playing
    if (videoPlaying) {
      interval = setInterval(updateChartData, 2000);
      // updateChartData();
    }
    // Cleanup
    return () => {
      if (interval) clearInterval(interval);
      // workerRef.current?.terminate(); // Terminate worker on unmount
    }; */
  }, [videoDetectedKeypointsRef, webcamDetectedKeypointsRef, videoPlaying]);

  // Scroll to the right whenever chartData updates
  useEffect(() => {
    const scrollDiv = scrollRef.current;
    if (scrollDiv) {
      scrollDiv.scrollLeft = scrollDiv.scrollWidth; // Scroll to the far right
    }
  }, [chartData]); // Trigger when chartData changes

  // Dynamic width: 10px per frame, minimum 800px
  const chartWidth = Math.max(chartData.length * 10, parseInt('100%', 10));

  // Custom label formatter for the tooltip title
  const tooltipLabelFormatter = (value: any, payload: any[]) => {
    const frameId = payload[0]?.payload?.frame_id; // Get frame_id from the first payload item
    return `Frame ${frameId}`; // Custom title format
  };

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
              data={chartData}
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
            <div className="flex items-center gap-2 font-medium leading-none">
              Real-time FPS tracking
            </div>
            <div className="flex items-center gap-2 leading-none text-muted-foreground">
              Frame ID range: 0 - {chartData.length - 1 || 0}
            </div>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
