import { useEffect, useState } from "react";
import { createUltralyticsDetector } from "../pose/ultralyticsDetector";
import type { PoseDetector } from "../pose/types";

export type DetectorStatus = "loading" | "ready" | "error";

/**
 * Module-level singleton, deliberately never freed.
 *
 * Loading is expensive (a 12 MB model plus ONNX Runtime init), and React
 * StrictMode mounts effects twice — caching the promise avoids paying for it
 * twice in dev. It also removes a use-after-free hazard: freeing on unmount
 * while a cached promise hands the same model to the next mount would leave
 * the second mount holding a released model. One window, one model, app
 * lifetime.
 */
let cached: Promise<PoseDetector> | null = null;

function loadDetector(): Promise<PoseDetector> {
  if (!cached) {
    cached = createUltralyticsDetector().catch((err) => {
      // Don't cache a failure; let a remount retry.
      cached = null;
      throw err;
    });
  }
  return cached;
}

export function usePoseDetector() {
  const [detector, setDetector] = useState<PoseDetector | null>(null);
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
