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
import { eventEmitter } from "@/utils/eventEmitter";

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

export function FpsChart({ videoPlaying }: { videoPlaying: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const fpsDataRef = useRef<
    {
      frame_id: number;
      video: number | null;
      webcam: number | null;
      video_avg_fps: number | null;
      webcam_avg_fps: number | null;
    }[]
  >([]);
  const rafIdRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const UPDATE_INTERVAL = 500;

  useEffect(() => {
    const handleFpsData = (data: any) => {
      fpsDataRef.current = data;
    };
    eventEmitter.on("fps_data", handleFpsData);
    return () => eventEmitter.off("fps_data", handleFpsData);
  }, []);

  const animate = (timestamp: number) => {
    if (!videoPlaying) {
      rafIdRef.current = null;
      return;
    }

    // Throttle updates to ~10 FPS for smoothness without overloading
    if (timestamp - lastUpdateRef.current >= UPDATE_INTERVAL) {
      if (scrollRef.current) {
        scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
      }
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

  const chartWidth = Math.max(fpsDataRef.current.length * 10, 800);

  return (
    <Card className="border-0 shadow-(--shadow-custom-neuromorphic)">
      <CardHeader>
        <CardTitle>FPS Over Time</CardTitle>
        <CardDescription>
          Visualize the FPS data over time for both video and webcam streams.
        </CardDescription>
      </CardHeader>
      <div className="px-[20px] flex">
        <CardContent
          className="overflow-x-scroll h-[300px] w-full"
          ref={scrollRef}
        >
          <ChartContainer
            config={chartConfig}
            style={{
              height: "280px",
              width: `${chartWidth}px`, // Set explicit width for the chart container
            }}
          >
            <LineChart
              accessibilityLayer
              data={fpsDataRef.current}
              margin={{ left: 12, right: 12, top: 10, bottom: 10 }}
              width={chartWidth}
              height={280}
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
              <p>
                Average Video Tracking FPS:{" "}
                {fpsDataRef.current[
                  fpsDataRef.current.length - 1
                ]?.video_avg_fps?.toFixed(2) || "N/A"}
              </p>
              <p>
                Average Real-time Tracking FPS:{" "}
                {fpsDataRef.current[
                  fpsDataRef.current.length - 1
                ]?.webcam_avg_fps?.toFixed(2) || "N/A"}
              </p>
            </div>
            <div className="flex items-center gap-2 leading-none text-muted-foreground">
              Frame ID range: 0 - {fpsDataRef.current.length - 1 || 0}
            </div>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
