import type {
	BodyDetector,
	BodyFrame,
	HandDetector,
	HandFrame,
	OnBlastMetrics,
	PointingMetrics,
	PostureMetrics,
} from "@on-blast/vision";
import {
	detectOnBlast,
	detectPointing,
	detectPosture,
	drawHand,
	History,
	HoldTrigger,
	NO_ON_BLAST,
	NO_POINTING,
	NO_POSTURE,
	palmSpan,
} from "@on-blast/vision";
import { useEffect, useRef, useState } from "react";

/** How long the pose must hold before firing, to reject a hand passing through. */
const HOLD_MS = 5;
/** Disarm window after a hit, so one gesture is one sting. */
const COOLDOWN_MS = 150;
/** The point must be held briefly before the phrase fires. */
const POINT_HOLD_MS = 250;

const HAND_COLORS = ["rgb(0,255,0)", "rgb(51,153,255)"];

export interface VisionStats {
	backend: string;
	inferenceMs: number;
	detectFps: number;
	renderFps: number;
	metrics: OnBlastMetrics;
	holdProgress: number;
	/** 0..1 remaining cooldown after a hit; 0 when armed. */
	cooldown: number;
	posture: PostureMetrics;
	pointing: PointingMetrics;
	bodyMs: number;
}

const EMPTY_STATS: VisionStats = {
	backend: "—",
	inferenceMs: 0,
	detectFps: 0,
	renderFps: 0,
	metrics: NO_ON_BLAST,
	holdProgress: 0,
	cooldown: 0,
	posture: NO_POSTURE,
	pointing: NO_POINTING,
	bodyMs: 0,
};

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

interface Options {
	detector: HandDetector | null;
	bodyDetector: BodyDetector | null;
	stream: MediaStream | null;
	/** When false the detect loop idles — used to freeze things after the sting. */
	active: boolean;
	onTrigger: () => void;
	/** Fires on the edge where the requested hand raises an index finger. */
	onPoint: () => void;
	/** Called every detection pass with the current shoulder state. */
	onPosture: (posture: PostureMetrics) => void;
}

export function useVisionLoop({
	detector,
	bodyDetector,
	stream,
	active,
	onTrigger,
	onPoint,
	onPosture,
}: Options) {
	const videoRef = useRef<HTMLVideoElement | null>(null);
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	/** Latest result. A ref, not state — state here would rerender at frame rate. */
	const frameRef = useRef<HandFrame | null>(null);
	const historyRef = useRef(new History<HandFrame>(120));
	const metricsRef = useRef<OnBlastMetrics>(NO_ON_BLAST);
	const holdRef = useRef(new HoldTrigger(HOLD_MS, COOLDOWN_MS));
	const holdProgressRef = useRef(0);
	const cooldownRef = useRef(0);
	const renderFps = useRef(new FpsCounter());
	const detectFps = useRef(new FpsCounter());
	const bodyFrameRef = useRef<BodyFrame | null>(null);
	const postureRef = useRef<PostureMetrics>(NO_POSTURE);
	const pointingRef = useRef<PointingMetrics>(NO_POINTING);
	const onTriggerRef = useRef(onTrigger);
	onTriggerRef.current = onTrigger;
	const onPostureRef = useRef(onPosture);
	onPostureRef.current = onPosture;
	const onPointRef = useRef(onPoint);
	onPointRef.current = onPoint;
	// Edge-triggered with release required, so holding the pose fires once.
	const pointHoldRef = useRef(new HoldTrigger(POINT_HOLD_MS, 0));

	const [stats, setStats] = useState<VisionStats>(EMPTY_STATS);

	useEffect(() => {
		const video = videoRef.current;
		if (!video) return;
		video.srcObject = stream;
		if (stream) void video.play().catch(() => {});
		return () => {
			video.srcObject = null;
		};
	}, [stream]);

	// Render loop: display rate, never blocked by detection.
	useEffect(() => {
		let raf = requestAnimationFrame(draw);

		function draw() {
			raf = requestAnimationFrame(draw);
			const canvas = canvasRef.current;
			const video = videoRef.current;
			if (!canvas || !video) return;
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
			const vw = video.videoWidth;
			const vh = video.videoHeight;
			if (frame && vw > 0 && vh > 0) {
				// Landmarks are normalized to the video frame, and the video is laid
				// out with object-fit: contain — so reproduce that fit here or the
				// overlay drifts off the hands.
				const frameAspect = vw / vh;
				const drawWidth = width / height > frameAspect ? height * frameAspect : width;
				const drawHeight = drawWidth / frameAspect;

				ctx.save();
				ctx.translate((width - drawWidth) / 2, (height - drawHeight) / 2);
				frame.hands.forEach((hand, i) => {
					drawHand(ctx, hand, {
						width: drawWidth,
						height: drawHeight,
						color: HAND_COLORS[i % HAND_COLORS.length],
						lineWidth: 2.5 * dpr,
						radius: 3.5 * dpr,
					});
				});
				ctx.restore();
			}
			renderFps.current.tick();
		}

		return () => cancelAnimationFrame(raf);
	}, []);

	// Detection loop: its own pace, independent of the render loop.
	useEffect(() => {
		if (!detector || !active) return;
		let running = true;

		void (async () => {
			while (running) {
				const video = videoRef.current;
				if (!video || video.readyState < 2 || video.videoWidth === 0) {
					await sleep(80);
					continue;
				}

				try {
					const now = performance.now();
					const frame = detector.detect(video, now);
					if (!running) break;
					frameRef.current = frame;
					historyRef.current.push(frame, now);
					detectFps.current.tick();

					const metrics = detectOnBlast(frame, historyRef.current, undefined, now);
					metricsRef.current = metrics;

					const pointing = detectPointing(frame);
					pointingRef.current = pointing;
					if (pointHoldRef.current.update(pointing.ok, now).fired) {
						onPointRef.current();
					}

					// Body pose is optional: the sting works without it, so a missing or
					// still-loading body model must not stall hand detection.
					if (bodyDetector) {
						const body = bodyDetector.detect(video, now);
						bodyFrameRef.current = body;
						const posture = detectPosture(body);
						postureRef.current = posture;
						onPostureRef.current(posture);
					}

					const { progress, fired, cooldown } = holdRef.current.update(metrics.ok, now);
					holdProgressRef.current = progress;
					cooldownRef.current = cooldown;
					// Detection continues after a hit; HoldTrigger's cooldown is what
					// stops a held pose from machine-gunning the sting.
					if (fired) onTriggerRef.current();
				} catch (err) {
					if (!running) break;
					console.error("[hands] detection failed", err);
					await sleep(300);
				}

				// Yield so at least one frame gets composited between passes.
				await nextFrame();
			}
		})();

		return () => {
			running = false;
			holdRef.current.reset();
			pointHoldRef.current.reset();
			holdProgressRef.current = 0;
			cooldownRef.current = 0;
		};
	}, [detector, bodyDetector, active]);

	// Sample the refs on a timer rather than setting state per frame.
	useEffect(() => {
		const id = setInterval(() => {
			setStats({
				backend: detector?.backend ?? "—",
				inferenceMs: frameRef.current?.inferenceMs ?? 0,
				detectFps: detectFps.current.read(),
				renderFps: renderFps.current.read(),
				metrics: metricsRef.current,
				holdProgress: holdProgressRef.current,
				cooldown: cooldownRef.current,
				posture: postureRef.current,
				pointing: pointingRef.current,
				bodyMs: bodyFrameRef.current?.inferenceMs ?? 0,
			});
		}, 100);
		return () => clearInterval(id);
	}, [detector]);

	const reset = () => {
		historyRef.current.clear();
		frameRef.current = null;
		metricsRef.current = NO_ON_BLAST;
		bodyFrameRef.current = null;
		postureRef.current = NO_POSTURE;
		pointingRef.current = NO_POINTING;
		holdRef.current.reset();
		pointHoldRef.current.reset();
		holdProgressRef.current = 0;
		cooldownRef.current = 0;
	};

	return { videoRef, canvasRef, stats, reset };
}

export { palmSpan };
