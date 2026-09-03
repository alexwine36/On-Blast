import type { HandFrame } from "./types";

export const POINTING_UP = "Pointing_Up";

export interface PointingConfig {
	/** Minimum classifier confidence. */
	scoreMin: number;
	/** Which of the person's hands must point. */
	hand: "left" | "right" | "any";
	/**
	 * Whether the frames handed to the detector are mirrored.
	 *
	 * MediaPipe labels handedness assuming a mirrored selfie image. We feed it
	 * the raw camera frame and mirror only in CSS for display, so its labels
	 * are swapped relative to the actual person.
	 */
	inputMirrored: boolean;
}

export const DEFAULT_POINTING: PointingConfig = {
	scoreMin: 0.5,
	hand: "right",
	inputMirrored: false,
};

export interface PointingMetrics {
	ok: boolean;
	/** A pointing hand was seen, whichever hand it was. */
	pointing: boolean;
	/** Which of the person's hands is pointing, corrected for mirroring. */
	hand: "left" | "right" | "unknown";
	/** Raw MediaPipe label, shown in the HUD so a swap is diagnosable. */
	rawHandedness: string;
	score: number;
	reason: string;
}

export const NO_POINTING: PointingMetrics = {
	ok: false,
	pointing: false,
	hand: "unknown",
	rawHandedness: "",
	score: 0,
	reason: "no hands",
};

/** Convert MediaPipe's image-relative label into the person's own hand. */
export function toUserHand(label: string, inputMirrored: boolean): "left" | "right" | "unknown" {
	const l = label.toLowerCase();
	if (l !== "left" && l !== "right") return "unknown";
	if (inputMirrored) return l;
	return l === "left" ? "right" : "left";
}

/**
 * Detects an index finger raised on the requested hand.
 *
 * Uses MediaPipe's built-in Pointing_Up class rather than hand-rolled landmark
 * geometry: the classifier already handles finger curl, orientation and the
 * cases where a raised index is ambiguous against a fist or a peace sign.
 */
export function detectPointing(
	frame: HandFrame | undefined,
	config: PointingConfig = DEFAULT_POINTING,
): PointingMetrics {
	if (!frame || frame.hands.length === 0) return NO_POINTING;

	const candidates = frame.hands
		.map((h) => ({
			pointing: h.gesture === POINTING_UP,
			score: h.gestureScore,
			raw: h.handedness,
			hand: toUserHand(h.handedness, config.inputMirrored),
		}))
		.sort((a, b) => Number(b.pointing) - Number(a.pointing) || b.score - a.score);

	const best = candidates[0];
	const base = {
		pointing: best.pointing,
		hand: best.hand,
		rawHandedness: best.raw,
		score: best.pointing ? best.score : 0,
	};

	if (!best.pointing) return { ...base, ok: false, reason: "point your index finger up" };
	if (best.score < config.scoreMin) return { ...base, ok: false, reason: "hold the point steady" };
	if (config.hand !== "any" && best.hand !== config.hand) {
		return { ...base, ok: false, reason: `use your ${config.hand} hand` };
	}
	return { ...base, ok: true, reason: "pointing" };
}
