import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import type { BodyDetector, BodyFrame } from "./types";

export interface BodyDetectorOptions {
	/** Directory holding the MediaPipe wasm runtime. */
	wasmPath: string;
	/** URL of the pose landmarker `.task` bundle. */
	modelPath: string;
}

/** Body pose, for shoulder height. Same wasm runtime as the hand model. */
export async function createMediaPipeBodyDetector({
	wasmPath,
	modelPath,
}: BodyDetectorOptions): Promise<BodyDetector> {
	const fileset = await FilesetResolver.forVisionTasks(wasmPath);

	let landmarker: PoseLandmarker;
	try {
		landmarker = await PoseLandmarker.createFromOptions(fileset, {
			baseOptions: { modelAssetPath: modelPath, delegate: "GPU" },
			runningMode: "VIDEO",
			numPoses: 1,
		});
	} catch (err) {
		console.warn("[body] GPU delegate unavailable, falling back to CPU", err);
		landmarker = await PoseLandmarker.createFromOptions(fileset, {
			baseOptions: { modelAssetPath: modelPath, delegate: "CPU" },
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
