import type { History } from "../util/history";
import { palmSpan } from "./landmarks";
import type { HandFrame } from "./types";

export const OPEN_PALM = "Open_Palm";

export interface OnBlastConfig {
	/**
	 * How many open palms must be present.
	 *
	 * One, because on a phone the other hand is holding the phone: requiring
	 * two forces you to either put it down or hold it at arm's length.
	 */
	handsRequired: number;
	/** Minimum classifier confidence for a hand to count as an open palm. */
	palmScoreMin: number;
	/** Palm span (normalized) at which a hand counts as "at the screen". */
	spanMin: number;
	/** Look-back window for measuring approach. */
	approachWindowMs: number;
	/** Growth ratio over that window that counts as "coming closer fast". */
	approachMin: number;
	/**
	 * Require actual forward motion, not just nearby hands.
	 *
	 * With this off, holding open palms near the lens satisfies the gate
	 * indefinitely and the sting repeats. The gesture is a *thrust*, so motion is
	 * the real signal and palm span is only a floor that rejects distant hands.
	 */
	requireApproach: boolean;
}

export const DEFAULT_ON_BLAST: OnBlastConfig = {
	handsRequired: 1,
	palmScoreMin: 0.5,
	// Measured on camera: a hand resting at desk height reads ~0.114, and hands
	// deliberately presented read ~0.185. 0.15 sits between them rather than
	// hugging the resting value, so idle gesturing doesn't fire the sting.
	spanMin: 0.15,
	approachWindowMs: 400,
	approachMin: 1.12,
	requireApproach: false,
};

export interface OnBlastMetrics {
	ok: boolean;
	handsSeen: number;
	openPalms: number;
	/** Best two palm-classifier scores. */
	palmScores: [number, number];
	/** Palm spans, largest first. */
	spans: [number, number];
	/** Span growth ratio over the look-back window; 1 = no change. */
	approach: number;
	reason: string;
}

export const NO_ON_BLAST: OnBlastMetrics = {
	ok: false,
	handsSeen: 0,
	openPalms: 0,
	palmScores: [0, 0],
	spans: [0, 0],
	approach: 1,
	reason: "no hands",
};

/**
 * The "on blast" pose: both palms open and thrust at the camera.
 *
 * Depth comes from apparent palm size rather than any true z, so the hand
 * either has to be big in frame (close) or growing quickly (moving closer).
 * Either satisfies the gate, because a fast shove can fire before the hand
 * ever gets large.
 */
export function detectOnBlast(
	frame: HandFrame | undefined,
	history: History<HandFrame>,
	config: OnBlastConfig = DEFAULT_ON_BLAST,
	now = performance.now(),
): OnBlastMetrics {
	if (!frame || frame.hands.length === 0) return NO_ON_BLAST;

	const handsSeen = frame.hands.length;
	const open = frame.hands.filter(
		(h) => h.gesture === OPEN_PALM && h.gestureScore >= config.palmScoreMin,
	);

	const scores = frame.hands
		.map((h) => (h.gesture === OPEN_PALM ? h.gestureScore : 0))
		.sort((a, b) => b - a);
	const spansAll = frame.hands.map(palmSpan).sort((a, b) => b - a);
	const palmScores: [number, number] = [scores[0] ?? 0, scores[1] ?? 0];
	const spans: [number, number] = [spansAll[0] ?? 0, spansAll[1] ?? 0];

	// Track the nearest palm rather than an average across hands: with a
	// second hand drifting in and out of frame, a mean jumps for reasons that
	// have nothing to do with moving toward the camera.
	const nearestSpan = (f: HandFrame) => (f.hands.length ? Math.max(...f.hands.map(palmSpan)) : 0);
	const past = history.before(config.approachWindowMs, now);
	const nowSpan = nearestSpan(frame);
	const thenSpan =
		past && past.item.hands.length >= config.handsRequired ? nearestSpan(past.item) : 0;
	const approach = thenSpan > 0.01 ? nowSpan / thenSpan : 1;

	const base = {
		handsSeen,
		openPalms: open.length,
		palmScores,
		spans,
		approach,
	};

	const need = config.handsRequired;
	if (handsSeen < need) {
		return { ...base, ok: false, reason: need > 1 ? "need both hands" : "show a hand" };
	}
	if (open.length < need) {
		return { ...base, ok: false, reason: need > 1 ? "open both palms" : "open your palm" };
	}

	// Gate on the least-near of the hands we require, so a hand at the lens
	// cannot carry one still hanging back.
	const gateSpan = spans[Math.min(need, spans.length) - 1] ?? 0;
	const bigEnough = gateSpan >= config.spanMin;
	const approaching = approach >= config.approachMin;

	if (config.requireApproach) {
		// Both required: hands have to be present AND actively coming forward.
		// Holding still settles `approach` back to ~1, which releases the gate —
		// that is what stops a held pose from repeating.
		if (!bigEnough) return { ...base, ok: false, reason: "bring hands closer" };
		if (!approaching) return { ...base, ok: false, reason: "thrust them forward" };
		return { ...base, ok: true, reason: "thrust" };
	}

	if (!bigEnough && !approaching) {
		return { ...base, ok: false, reason: "push hands toward the camera" };
	}
	return {
		...base,
		ok: true,
		reason: approaching && !bigEnough ? "thrust" : "at the screen",
	};
}
