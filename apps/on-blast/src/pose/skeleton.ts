import { KEYPOINT_THRESHOLD } from "./config";
import type { Person } from "./types";

/** COCO-17 keypoint order, as produced by Ultralytics pose models. */
export const KEYPOINT_NAMES = [
  "nose",
  "left_eye",
  "right_eye",
  "left_ear",
  "right_ear",
  "left_shoulder",
  "right_shoulder",
  "left_elbow",
  "right_elbow",
  "left_wrist",
  "right_wrist",
  "left_hip",
  "right_hip",
  "left_knee",
  "right_knee",
  "left_ankle",
  "right_ankle",
] as const;

/** Ultralytics' `pose_palette`, kept in its original index order. */
const POSE_PALETTE = [
  "rgb(255,128,0)",
  "rgb(255,153,51)",
  "rgb(255,178,102)",
  "rgb(230,230,0)",
  "rgb(255,153,255)",
  "rgb(153,204,255)",
  "rgb(255,102,255)",
  "rgb(255,51,255)",
  "rgb(102,178,255)",
  "rgb(51,153,255)",
  "rgb(255,153,153)",
  "rgb(255,102,102)",
  "rgb(255,51,51)",
  "rgb(153,255,153)",
  "rgb(102,255,102)",
  "rgb(51,255,51)",
  "rgb(0,255,0)",
  "rgb(0,0,255)",
  "rgb(255,0,0)",
  "rgb(255,255,255)",
] as const;

/** The 19 COCO limbs, zero-indexed (Ultralytics lists these one-indexed). */
export const SKELETON: readonly (readonly [number, number])[] = [
  [15, 13],
  [13, 11],
  [16, 14],
  [14, 12],
  [11, 12],
  [5, 11],
  [6, 12],
  [5, 6],
  [5, 7],
  [6, 8],
  [7, 9],
  [8, 10],
  [1, 2],
  [0, 1],
  [0, 2],
  [1, 3],
  [2, 4],
  [3, 5],
  [4, 6],
];

// Ultralytics' limb_color / kpt_color index maps: blue legs, magenta hips,
// orange arms, green head.
const LIMB_COLORS = [9, 9, 9, 9, 7, 7, 7, 0, 0, 0, 0, 0, 16, 16, 16, 16, 16, 16, 16].map(
  (i) => POSE_PALETTE[i],
);
const KEYPOINT_COLORS = [16, 16, 16, 16, 16, 0, 0, 0, 0, 0, 0, 9, 9, 9, 9, 9, 9].map(
  (i) => POSE_PALETTE[i],
);

export interface DrawOptions {
  /** Multiplier from keypoint space to canvas device pixels. */
  scale: number;
  radius?: number;
  lineWidth?: number;
  threshold?: number;
}

/**
 * Draw one person's skeleton. Coordinates are multiplied by `scale`, so this
 * expects a canvas whose transform is identity and whose backing store is in
 * device pixels.
 */
export function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  person: Person,
  { scale, radius = 3, lineWidth = 2, threshold = KEYPOINT_THRESHOLD }: DrawOptions,
): void {
  const points = person.keypoints;

  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  for (let i = 0; i < SKELETON.length; i++) {
    const [from, to] = SKELETON[i];
    const a = points[from];
    const b = points[to];
    // A limb is only meaningful if both ends were actually located.
    if (!a || !b || a[2] < threshold || b[2] < threshold) continue;
    ctx.strokeStyle = LIMB_COLORS[i];
    ctx.beginPath();
    ctx.moveTo(a[0] * scale, a[1] * scale);
    ctx.lineTo(b[0] * scale, b[1] * scale);
    ctx.stroke();
  }

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (!p || p[2] < threshold) continue;
    ctx.fillStyle = KEYPOINT_COLORS[i] ?? "rgb(255,255,255)";
    ctx.beginPath();
    ctx.arc(p[0] * scale, p[1] * scale, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}
