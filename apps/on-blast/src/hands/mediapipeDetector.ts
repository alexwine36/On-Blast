import { FilesetResolver, GestureRecognizer } from "@mediapipe/tasks-vision";
import type { HandDetector, HandFrame } from "./types";

const WASM_PATH = "/mediapipe/wasm";
const MODEL_PATH = "/mediapipe/models/gesture_recognizer.task";

/**
 * The only module that touches MediaPipe (Apache-2.0).
 *
 * Both the wasm runtime and the model are served from `public/`, so nothing is
 * fetched from a CDN at runtime and the app works offline.
 */
export async function createMediaPipeHandDetector(): Promise<HandDetector> {
	const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);

	let delegate: "GPU" | "CPU" = "GPU";
	let recognizer: GestureRecognizer;
	try {
		recognizer = await GestureRecognizer.createFromOptions(fileset, {
			baseOptions: { modelAssetPath: MODEL_PATH, delegate: "GPU" },
			runningMode: "VIDEO",
			numHands: 2,
		});
	} catch (err) {
		// Some webviews have no usable WebGL context; the CPU graph still works.
		console.warn("[hands] GPU delegate unavailable, falling back to CPU", err);
		delegate = "CPU";
		recognizer = await GestureRecognizer.createFromOptions(fileset, {
			baseOptions: { modelAssetPath: MODEL_PATH, delegate: "CPU" },
			runningMode: "VIDEO",
			numHands: 2,
		});
	}

	// recognizeForVideo rejects a timestamp that doesn't advance, which happens
	// whenever two calls land inside the same millisecond.
	let lastTimestamp = -1;

	return {
		get backend() {
			return delegate.toLowerCase();
		},
		detect(video: HTMLVideoElement, timestampMs: number): HandFrame {
			const ts = timestampMs <= lastTimestamp ? lastTimestamp + 1 : timestampMs;
			lastTimestamp = ts;

			const started = performance.now();
			const res = recognizer.recognizeForVideo(video, ts);
			const inferenceMs = performance.now() - started;

			return {
				inferenceMs,
				hands: res.landmarks.map((landmarks, i) => ({
					landmarks,
					handedness: res.handedness[i]?.[0]?.categoryName ?? "Unknown",
					gesture: res.gestures[i]?.[0]?.categoryName ?? "None",
					gestureScore: res.gestures[i]?.[0]?.score ?? 0,
				})),
			};
		},
		close() {
			recognizer.close();
		},
	};
}
