import type { BodyDetector, BodyDetectorOptions } from "@on-blast/vision";
import { createMediaPipeBodyDetector } from "@on-blast/vision";
import { useEffect, useState } from "react";

/** Singleton for the same reasons as the hand detector — see useHandDetector. */
let cached: Promise<BodyDetector> | null = null;

function loadDetector(options: BodyDetectorOptions): Promise<BodyDetector> {
	if (!cached) {
		cached = createMediaPipeBodyDetector(options).catch((err) => {
			cached = null;
			throw err;
		});
	}
	return cached;
}

/** Pass `enabled: false` to skip loading the model entirely. */
export function useBodyDetector(options: BodyDetectorOptions, enabled = true) {
	const [detector, setDetector] = useState<BodyDetector | null>(null);
	const [error, setError] = useState<string | null>(null);

	// Load-once singleton; see useHandDetector.
	// biome-ignore lint/correctness/useExhaustiveDependencies: load-once
	useEffect(() => {
		if (!enabled) return;
		let cancelled = false;
		loadDetector(options).then(
			(d) => {
				if (!cancelled) setDetector(d);
			},
			(err: unknown) => {
				// Non-fatal: the sting works without body pose, so surface it and
				// carry on rather than blocking the whole app.
				if (cancelled) return;
				console.error("[body] failed to load", err);
				setError(err instanceof Error ? err.message : String(err));
			},
		);
		return () => {
			cancelled = true;
		};
	}, [enabled]);

	return { detector, error };
}
