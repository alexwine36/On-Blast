/** A single COCO keypoint: `[x, y, confidence]` in source-image pixels. */
export type Keypoint = [x: number, y: number, conf: number];

export interface Person {
  /** 17 COCO keypoints, in the canonical order (see `KEYPOINT_NAMES`). */
  keypoints: Keypoint[];
  /** Detection confidence for this person. */
  score: number;
}

/** One inference result, normalized away from any particular backend. */
export interface PoseFrame {
  /** Image dimensions the keypoint coordinates are expressed in. */
  width: number;
  height: number;
  people: Person[];
  inferenceMs: number;
}

/** Anything we can hand a backend to run inference on. */
export type PoseSource = HTMLCanvasElement | HTMLVideoElement | ImageBitmap;

/**
 * The seam between the UI and whichever pose model is behind it.
 *
 * Everything above this interface is backend-agnostic, so swapping the
 * AGPL-licensed Ultralytics backend for an Apache-2.0 one (MediaPipe, MoveNet)
 * means adding one file in `src/pose/` and changing one import.
 */
export interface PoseDetector {
  /** Which compute backend actually engaged, e.g. `"webgpu"` or `"cpu"`. */
  readonly backend: string;
  predict(source: PoseSource): Promise<PoseFrame>;
  free(): void;
}
