import { useEffect, useState } from "react";
import { createMediaPipeHandDetector } from "../hands/mediapipeDetector";
import type { HandDetector } from "../hands/types";

export type DetectorStatus = "loading" | "ready" | "error";

/**
 * Module-level singleton, deliberately never closed.
 *
 * React StrictMode mounts effects twice, and loading is expensive (wasm plus
 * an 8 MB model). Caching the promise avoids paying twice in dev and removes a
 * use-after-close hazard where the second mount inherits a released handle.
 */
let cached: Promise<HandDetector> | null = null;

function loadDetector(): Promise<HandDetector> {
	if (!cached) {
		cached = createMediaPipeHandDetector().catch((err) => {
			cached = null; // don't cache a failure; let a remount retry
			throw err;
		});
	}
	return cached;
}

export function useHandDetector() {
	const [detector, setDetector] = useState<HandDetector | null>(null);
	const [status, setStatus] = useState<DetectorStatus>("loading");
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		loadDetector().then(
			(d) => {
				if (cancelled) return;
				setDetector(d);
				setStatus("ready");
			},
			(err: unknown) => {
				if (cancelled) return;
				setStatus("error");
				setError(err instanceof Error ? err.message : String(err));
			},
		);
		return () => {
			cancelled = true;
		};
	}, []);

	return { detector, status, error };
}
