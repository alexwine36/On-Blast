/**
 * Normalized x/y plus relative z. Pose landmarks additionally carry a
 * visibility score, which matters here because a seated webcam shot regularly
 * has wrists and hips out of frame.
 */
export interface BodyLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface BodyFrame {
  /** 33 BlazePose landmarks, or undefined when no body was found. */
  pose?: BodyLandmark[];
  inferenceMs: number;
}

export interface BodyDetector {
  detect(video: HTMLVideoElement, timestampMs: number): BodyFrame;
  close(): void;
}
