import type { HandDetector, HandDetectorOptions } from "@on-blast/vision";
import { createMediaPipeHandDetector } from "@on-blast/vision";
import { useEffect, useState } from "react";

export type DetectorStatus = "loading" | "ready" | "error";

/**
 * Module-level singleton, deliberately never closed.
 *
 * React StrictMode mounts effects twice, and loading is expensive (wasm plus
 * an 8 MB model). Caching the promise avoids paying twice in dev and removes a
 * use-after-close hazard where the second mount inherits a released handle.
 */
let cached: Promise<HandDetector> | null = null;

function loadDetector(options: HandDetectorOptions): Promise<HandDetector> {
	if (!cached) {
		cached = createMediaPipeHandDetector(options).catch((err) => {
			cached = null; // don't cache a failure; let a remount retry
			throw err;
		});
	}
	return cached;
}

export function useHandDetector(options: HandDetectorOptions) {
	const [detector, setDetector] = useState<HandDetector | null>(null);
	const [status, setStatus] = useState<DetectorStatus>("loading");
	const [error, setError] = useState<string | null>(null);

	// The detector is a process-wide singleton: options are read once on the
	// first load, so a later change would not reload it.
	// biome-ignore lint/correctness/useExhaustiveDependencies: load-once
	useEffect(() => {
		let cancelled = false;
		loadDetector(options).then(
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
