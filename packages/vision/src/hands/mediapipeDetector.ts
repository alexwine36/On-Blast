import { FilesetResolver, GestureRecognizer } from "@mediapipe/tasks-vision";
import type { HandDetector, HandFrame } from "./types";

export interface HandDetectorOptions {
	/** Directory holding the MediaPipe wasm runtime. */
	wasmPath: string;
	/** URL of the gesture recognizer `.task` bundle. */
	modelPath: string;
	/** Hands to track at once. */
	numHands?: number;
}

/**
 * The only module that touches MediaPipe (Apache-2.0).
 *
 * Both the wasm runtime and the model are served from `public/`, so nothing is
 * fetched from a CDN at runtime and the app works offline.
 */
export async function createMediaPipeHandDetector({
	wasmPath,
	modelPath,
	numHands = 2,
}: HandDetectorOptions): Promise<HandDetector> {
	const fileset = await FilesetResolver.forVisionTasks(wasmPath);

	let delegate: "GPU" | "CPU" = "GPU";
	let recognizer: GestureRecognizer;
	try {
		recognizer = await GestureRecognizer.createFromOptions(fileset, {
			baseOptions: { modelAssetPath: modelPath, delegate: "GPU" },
			runningMode: "VIDEO",
			numHands,
		});
	} catch (err) {
		// Some webviews have no usable WebGL context; the CPU graph still works.
		console.warn("[hands] GPU delegate unavailable, falling back to CPU", err);
		delegate = "CPU";
		recognizer = await GestureRecognizer.createFromOptions(fileset, {
			baseOptions: { modelAssetPath: modelPath, delegate: "CPU" },
			runningMode: "VIDEO",
			numHands,
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
