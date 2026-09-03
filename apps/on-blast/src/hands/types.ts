/** Normalized to the frame: x and y in 0..1, z relative depth (smaller = nearer). */
export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

export interface Hand {
  /** 21 landmarks in MediaPipe's canonical order. */
  landmarks: HandLandmark[];
  handedness: string;
  /** Classified gesture, e.g. "Open_Palm", "Closed_Fist", "None". */
  gesture: string;
  gestureScore: number;
}

export interface HandFrame {
  hands: Hand[];
  inferenceMs: number;
}

/**
 * The seam between the UI and whichever hand model is behind it.
 *
 * `detect` is synchronous: MediaPipe's `recognizeForVideo` returns directly
 * rather than returning a promise.
 */
export interface HandDetector {
  readonly backend: string;
  detect(video: HTMLVideoElement, timestampMs: number): HandFrame;
  close(): void;
}
