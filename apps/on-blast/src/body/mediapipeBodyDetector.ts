import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import type { BodyDetector, BodyFrame } from "./types";

const WASM_PATH = "/mediapipe/wasm";
const MODEL_PATH = "/mediapipe/models/pose_landmarker_lite.task";

/** Body pose, for shoulder height. Same wasm runtime as the hand model. */
export async function createMediaPipeBodyDetector(): Promise<BodyDetector> {
  const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);

  let landmarker: PoseLandmarker;
  try {
    landmarker = await PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_PATH, delegate: "GPU" },
      runningMode: "VIDEO",
      numPoses: 1,
    });
  } catch (err) {
    console.warn("[body] GPU delegate unavailable, falling back to CPU", err);
    landmarker = await PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_PATH, delegate: "CPU" },
      runningMode: "VIDEO",
      numPoses: 1,
    });
  }

  // detectForVideo rejects a timestamp that doesn't advance.
  let lastTimestamp = -1;

  return {
    detect(video: HTMLVideoElement, timestampMs: number): BodyFrame {
      const ts = timestampMs <= lastTimestamp ? lastTimestamp + 1 : timestampMs;
      lastTimestamp = ts;
      const started = performance.now();
      const res = landmarker.detectForVideo(video, ts);
      return { pose: res.landmarks[0], inferenceMs: performance.now() - started };
    },
    close() {
      landmarker.close();
    },
  };
}
