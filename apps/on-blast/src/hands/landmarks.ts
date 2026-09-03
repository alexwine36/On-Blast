import type { Hand, HandLandmark } from "./types";

export const WRIST = 0;
export const THUMB_TIP = 4;
export const INDEX_MCP = 5;
export const MIDDLE_MCP = 9;
export const RING_MCP = 13;
export const PINKY_MCP = 17;

/** MediaPipe's 21-point hand skeleton. */
export const HAND_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],          // thumb
  [0, 5], [5, 6], [6, 7], [7, 8],          // index
  [9, 10], [10, 11], [11, 12],             // middle
  [13, 14], [14, 15], [15, 16],            // ring
  [0, 17], [17, 18], [18, 19], [19, 20],   // pinky
  [5, 9], [9, 13], [13, 17],               // knuckle line
];

const dist = (a: HandLandmark, b: HandLandmark) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Palm size in normalized frame units — wrist to middle knuckle.
 *
 * This is the depth cue: the hand's apparent size grows as it approaches the
 * lens. It's rotation-stable, unlike finger spans, because it doesn't change
 * when the fingers move.
 */
export function palmSpan(hand: Hand): number {
  const wrist = hand.landmarks[WRIST];
  const middle = hand.landmarks[MIDDLE_MCP];
  if (!wrist || !middle) return 0;
  return dist(wrist, middle);
}

export interface DrawHandOptions {
  /** Maps normalized coords to canvas pixels. */
  width: number;
  height: number;
  color: string;
  lineWidth: number;
  radius: number;
}

export function drawHand(
  ctx: CanvasRenderingContext2D,
  hand: Hand,
  { width, height, color, lineWidth, radius }: DrawHandOptions,
): void {
  const pts = hand.landmarks;

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  for (const [a, b] of HAND_CONNECTIONS) {
    const p = pts[a];
    const q = pts[b];
    if (!p || !q) continue;
    ctx.beginPath();
    ctx.moveTo(p.x * width, p.y * height);
    ctx.lineTo(q.x * width, q.y * height);
    ctx.stroke();
  }

  ctx.fillStyle = color;
  for (const p of pts) {
    ctx.beginPath();
    ctx.arc(p.x * width, p.y * height, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}
