import { useEffect, useRef, useState } from "react";
import { CAPTURE_WIDTH } from "../pose/config";
import { drawSkeleton } from "../pose/skeleton";
import type { PoseDetector, PoseFrame } from "../pose/types";

export interface PoseStats {
  backend: string;
  inferenceMs: number;
  inferenceFps: number;
  renderFps: number;
  people: number;
}

const EMPTY_STATS: PoseStats = {
  backend: "—",
  inferenceMs: 0,
  inferenceFps: 0,
  renderFps: 0,
  people: 0,
};

/** Counts ticks over a trailing one-second window. */
class FpsCounter {
  private ticks: number[] = [];

  tick(): void {
    this.ticks.push(performance.now());
    this.trim();
  }

  read(): number {
    this.trim();
    return this.ticks.length;
  }

  private trim(): void {
    const cutoff = performance.now() - 1000;
    while (this.ticks.length > 0 && this.ticks[0] < cutoff) this.ticks.shift();
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/**
 * Runs the render loop and the inference loop independently.
 *
 * Inference is stuck on the main thread — the library's ONNX Runtime loader
 * injects a `<script>` tag, so it cannot initialize inside a Worker. A slow
 * `predict()` therefore blocks JS. That is survivable only because the video is
 * a real `<video>` element composited by the browser rather than pixels we draw
 * ourselves: the picture stays smooth, and only this overlay goes stale.
 */
export function usePoseLoop(detector: PoseDetector | null, stream: MediaStream | null) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  /** Latest inference result. A ref, not state — state here would rerender at frame rate. */
  const frameRef = useRef<PoseFrame | null>(null);
  const renderFps = useRef(new FpsCounter());
  const inferenceFps = useRef(new FpsCounter());

  const [stats, setStats] = useState<PoseStats>(EMPTY_STATS);

  // Attach the stream to the element.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    if (stream) void video.play().catch(() => {});
    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  // Render loop: display rate, never awaits inference.
  useEffect(() => {
    let raf = requestAnimationFrame(draw);

    function draw() {
      raf = requestAnimationFrame(draw);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const width = Math.round(canvas.clientWidth * dpr);
      const height = Math.round(canvas.clientHeight * dpr);
      if (width === 0 || height === 0) return;
      // Resizing clears the canvas, so only do it when it actually changed.
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      ctx.clearRect(0, 0, width, height);

      const frame = frameRef.current;
      if (frame && frame.width > 0 && frame.height > 0) {
        // The canvas box rarely matches the camera's aspect ratio, so mirror
        // what `object-fit: contain` does to the video underneath: fit the
        // frame inside the box and center it. Getting this wrong shifts the
        // whole skeleton off the person.
        const frameAspect = frame.width / frame.height;
        const drawWidth = width / height > frameAspect ? height * frameAspect : width;
        const drawHeight = drawWidth / frameAspect;
        const scale = drawWidth / frame.width;

        ctx.save();
        ctx.translate((width - drawWidth) / 2, (height - drawHeight) / 2);
        for (const person of frame.people) {
          drawSkeleton(ctx, person, {
            scale,
            radius: 3.5 * dpr,
            lineWidth: 2.5 * dpr,
          });
        }
        ctx.restore();
      }
      renderFps.current.tick();
    }

    return () => cancelAnimationFrame(raf);
  }, []);

  // Inference loop: its own pace, independent of the render loop.
  useEffect(() => {
    if (!detector) return;

    let running = true;
    const capture = document.createElement("canvas");
    // The backend reads pixels straight back out of this canvas.
    const captureCtx = capture.getContext("2d", { willReadFrequently: true });

    void (async () => {
      while (running) {
        const video = videoRef.current;
        if (!captureCtx || !video || video.readyState < 2 || video.videoWidth === 0) {
          await sleep(80);
          continue;
        }

        // Downscale before inference. The model resizes internally anyway, but
        // preprocessing reads raw pixels at source resolution, so feeding it a
        // 720p frame wastes real time on the CPU path.
        const width = Math.min(CAPTURE_WIDTH, video.videoWidth);
        const height = Math.max(1, Math.round((video.videoHeight / video.videoWidth) * width));
        if (capture.width !== width || capture.height !== height) {
          capture.width = width;
          capture.height = height;
        }
        captureCtx.drawImage(video, 0, 0, width, height);

        try {
          const frame = await detector.predict(capture);
          if (!running) break;
          frameRef.current = frame;
          inferenceFps.current.tick();
        } catch (err) {
          if (!running) break;
          console.error("[pose] inference failed", err);
          await sleep(300);
        }

        // Yield so at least one frame gets composited between passes.
        await nextFrame();
      }
    })();

    return () => {
      running = false;
      frameRef.current = null;
    };
  }, [detector]);

  // Sample the refs on a timer rather than setting state per frame.
  useEffect(() => {
    const id = setInterval(() => {
      const frame = frameRef.current;
      setStats({
        backend: detector?.backend ?? "—",
        inferenceMs: frame?.inferenceMs ?? 0,
        inferenceFps: inferenceFps.current.read(),
        renderFps: renderFps.current.read(),
        people: frame?.people.length ?? 0,
      });
    }, 250);
    return () => clearInterval(id);
  }, [detector]);

  return { videoRef, canvasRef, stats };
}
