interface Keypoint {
  kpt_id: number;
  normalized_coords: number[];
  visibility: number;
}

type Point = number[] | null;

// Calculate the Euclidean distance between two points
export const calculateDistance = (point1: Point, point2: Point): number => {
  if (!point1 || !point2) return Infinity; // Return Infinity if either point is null
  const dx = point1[0] - point2[0];
  const dy = point1[1] - point2[1];
  return Math.sqrt(dx * dx + dy * dy);
};

// Calculate the angle in degrees at point b formed by points a-b-c
export const calculateAngle = (a: Point, b: Point, c: Point): number | null => {
  if (!a || !b || !c) return null;
  const aLength = calculateDistance(b, c);
  const bLength = calculateDistance(a, c);
  const cLength = calculateDistance(a, b);
  try {
    const cosAngle = (aLength * aLength + cLength * cLength - bLength * bLength) / (2 * aLength * cLength);
    const angle = Math.acos(Math.min(Math.max(cosAngle, -1), 1)); // Clamp to [-1, 1] to avoid NaN
    return (angle * 180) / Math.PI; // Convert radians to degrees
  } catch {
    return null;
  }
};

// Check if a point is valid (not null and has valid coordinates)
export const isValidPoint = (point: Point): boolean => point !== null && point.length >= 2;

// Draw text with a black outline and white fill
export const drawTextWithOutline = (
  ctx: CanvasRenderingContext2D,
  text: string,
  position: Point,
  fontScale: number,
  thickness: number
): void => {
  if (!position) return; // Skip if position is null
  const font = `${fontScale * 10}px`; // Approximate OpenCV font size
  ctx.font = font;
  ctx.lineWidth = thickness + 1;

  // Black outline
  ctx.strokeStyle = "#000";
  ctx.strokeText(text, position[0] - 1, position[1] - 1);
  ctx.strokeText(text, position[0] + 1, position[1] - 1);
  ctx.strokeText(text, position[0] - 1, position[1] + 1);
  ctx.strokeText(text, position[0] + 1, position[1] + 1);

  // White fill
  ctx.fillStyle = "#fff";
  ctx.fillText(text, position[0], position[1]);
};

// Draw a filled sector for the interior angle
export const drawInteriorSector = (
  ctx: CanvasRenderingContext2D,
  center: Point,
  ptA: Point,
  ptB: Point,
  width: number,
  height: number
): void => {
  if (!center || !ptA || !ptB) return; // Skip if any point is null

  const radius = 10;
  const arcColor = "rgba(242, 165, 88, 1)"; // Orange outline
  const sectorColor = "rgba(242, 165, 88, 0.7)"; // Orange fill with transparency

  const calculateClockwiseAngleFromXAxis = (center: number[], pt: number[]): number => {
    const dx = pt[0] - center[0];
    const dy = pt[1] - center[1];
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    return angle >= 0 ? angle : angle + 360;
  };

  let angleA = calculateClockwiseAngleFromXAxis(center, ptA);
  let angleB = calculateClockwiseAngleFromXAxis(center, ptB);

  if (angleB < angleA) [angleA, angleB] = [angleB, angleA];
  const angleDiff = angleB - angleA;
  const startAngle = angleA * (Math.PI / 180); // Convert to radians
  const endAngle = (angleB * (Math.PI / 180)) - (angleDiff > 180 ? 2 * Math.PI : 0);

  // Draw filled sector
  ctx.beginPath();
  ctx.arc(center[0], center[1], radius, startAngle, endAngle, angleDiff > 180);
  ctx.lineTo(center[0], center[1]);
  ctx.closePath();
  ctx.fillStyle = sectorColor;
  ctx.fill();

  // Draw arc outline
  ctx.beginPath();
  ctx.arc(center[0], center[1], radius, startAngle, endAngle, angleDiff > 180);
  ctx.strokeStyle = arcColor;
  ctx.lineWidth = 2;
  ctx.stroke();
};

// Draw angles for key joints on the canvas
export const drawAngles = (
  ctx: CanvasRenderingContext2D,
  keypoints: Keypoint[],
  width: number,
  height: number
): void => {
  // Convert keypoints to dictionary for easier access
  const kptsDict: { [key: number]: number[] } = {};
  keypoints.forEach((kpt) => {
    if (kpt.visibility > 0.5) {
      kptsDict[kpt.kpt_id] = [kpt.normalized_coords[0] * width, kpt.normalized_coords[1] * height]; // Use normalized coords
    }
    // console.log("kptsDict[kpt.kpt_id]", kptsDict[kpt.kpt_id]);
  });

  const getPoint = (kptId: number): Point => kptsDict[kptId] || null;

  // MediaPipe landmark indices
  const RShoulder = getPoint(12); // RIGHT_SHOULDER
  const RElbow = getPoint(14);   // RIGHT_ELBOW
  const RWrist = getPoint(16);   // RIGHT_WRIST
  const LShoulder = getPoint(11); // LEFT_SHOULDER
  const LElbow = getPoint(13);   // LEFT_ELBOW
  const LWrist = getPoint(15);   // LEFT_WRIST
  const Neck = getPoint(0);      // NOSE (approximate neck)
  const RHip = getPoint(24);     // RIGHT_HIP
  const RAnkle = getPoint(28);   // RIGHT_ANKLE
  const LHip = getPoint(23);     // LEFT_HIP
  const LAnkle = getPoint(27);   // LEFT_ANKLE
  const LKnee = getPoint(25);    // LEFT_KNEE
  const RKnee = getPoint(26);    // RIGHT_KNEE

  // Calculate angles
  const rArmAngle = calculateAngle(RShoulder, RElbow, RWrist);
  const lArmAngle = calculateAngle(LShoulder, LElbow, LWrist);
  const rShoulderAngle = calculateAngle(Neck, RShoulder, RElbow);
  const lShoulderAngle = calculateAngle(Neck, LShoulder, LElbow);
  const rHipAngle = calculateAngle(Neck, RHip, RAnkle);
  const lHipAngle = calculateAngle(Neck, LHip, LAnkle);

  // Calculate font scales (null checks already handled by calculateDistance returning Infinity)
  const fontScaleRArm = RElbow && RWrist ? Math.min(Math.max(calculateDistance(RElbow, RWrist) / 100, 0.5), 0.5) : 0.5;
  const fontScaleLArm = LElbow && LWrist ? Math.min(Math.max(calculateDistance(LElbow, LWrist) / 100, 0.5), 0.5) : 0.5;
  const fontScaleRShoulder = RShoulder && RElbow ? Math.min(Math.max(calculateDistance(RShoulder, RElbow) / 100, 0.5), 0.5) : 0.5;
  const fontScaleLShoulder = LShoulder && LElbow ? Math.min(Math.max(calculateDistance(LShoulder, LElbow) / 100, 0.5), 0.5) : 0.5;
  const fontScaleRHip = RHip && RAnkle ? Math.min(Math.max(calculateDistance(RHip, RAnkle) / 100, 0.5), 0.5) : 0.5;
  const fontScaleLHip = LHip && LAnkle ? Math.min(Math.max(calculateDistance(LHip, LAnkle) / 100, 0.5), 0.5) : 0.5;

  // Draw angles
  if (isValidPoint(RShoulder) && isValidPoint(RElbow) && isValidPoint(RWrist) && rArmAngle) {
    drawInteriorSector(ctx, RElbow, RShoulder, RWrist, width, height);
    drawTextWithOutline(ctx, `${rArmAngle.toFixed(1)}°`, RElbow, fontScaleRArm, 1);
  }
  if (isValidPoint(LShoulder) && isValidPoint(LElbow) && isValidPoint(LWrist) && lArmAngle) {
    drawInteriorSector(ctx, LElbow, LShoulder, LWrist, width, height);
    drawTextWithOutline(ctx, `${lArmAngle.toFixed(1)}°`, LElbow, fontScaleLArm, 1);
  }
  if (isValidPoint(RShoulder) && isValidPoint(LShoulder) && isValidPoint(RElbow) && rShoulderAngle) {
    drawInteriorSector(ctx, RShoulder, LShoulder, RElbow, width, height);
    drawTextWithOutline(ctx, `${rShoulderAngle.toFixed(1)}°`, RShoulder, fontScaleRShoulder, 1);
  }
  if (isValidPoint(LShoulder) && isValidPoint(RShoulder) && isValidPoint(LElbow) && lShoulderAngle) {
    drawInteriorSector(ctx, LShoulder, RShoulder, LElbow, width, height);
    drawTextWithOutline(ctx, `${lShoulderAngle.toFixed(1)}°`, LShoulder, fontScaleLShoulder, 1);
  }
  if (isValidPoint(RKnee) && isValidPoint(RHip) && isValidPoint(RAnkle) && rHipAngle) {
    drawInteriorSector(ctx, RKnee, RHip, RAnkle, width, height);
    drawTextWithOutline(ctx, `${rHipAngle.toFixed(1)}°`, RHip, fontScaleRHip, 1);
  }
  if (isValidPoint(LKnee) && isValidPoint(LHip) && isValidPoint(LAnkle) && lHipAngle) {
    drawInteriorSector(ctx, LKnee, LHip, LAnkle, width, height);
    drawTextWithOutline(ctx, `${lHipAngle.toFixed(1)}°`, LHip, fontScaleLHip, 1);
  }
};