import { useEffect, useState } from "react";
import { createMediaPipeBodyDetector } from "../body/mediapipeBodyDetector";
import type { BodyDetector } from "../body/types";

/** Singleton for the same reasons as the hand detector — see useHandDetector. */
let cached: Promise<BodyDetector> | null = null;

function loadDetector(): Promise<BodyDetector> {
  if (!cached) {
    cached = createMediaPipeBodyDetector().catch((err) => {
      cached = null;
      throw err;
    });
  }
  return cached;
}

export function useBodyDetector() {
  const [detector, setDetector] = useState<BodyDetector | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadDetector().then(
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
  }, []);

  return { detector, error };
}
