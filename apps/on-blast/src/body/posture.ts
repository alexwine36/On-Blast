import type { BodyFrame, BodyLandmark } from "./types";

// BlazePose 33-point indices.
export const NOSE = 0;
export const L_EAR = 7;
export const R_EAR = 8;
export const L_SHOULDER = 11;
export const R_SHOULDER = 12;
export const L_ELBOW = 13;
export const R_ELBOW = 14;
export const L_WRIST = 15;
export const R_WRIST = 16;

const MIN_VISIBILITY = 0.5;

export interface PostureConfig {
	/** How far outside the shoulder span a wrist must be, in shoulder widths. */
	spreadMin: number;
	/** How close to shoulder height a wrist must stay, in shoulder widths. */
	heightMax: number;
	/** Ear-to-shoulder gap when relaxed (larger) and fully shrugged (smaller). */
	gapRelaxed: number;
	gapShrugged: number;
}

export const DEFAULT_POSTURE: PostureConfig = {
	spreadMin: 0.65,
	heightMax: 0.7,
	// Starting estimates — tune from the live readout, the same way spanMin was.
	gapRelaxed: 0.95,
	gapShrugged: 0.55,
};

export interface PostureMetrics {
	visible: boolean;
	/** Arms held out to the sides: the gate that arms the synth. */
	armsOut: boolean;
	/**
	 * Ear-to-shoulder vertical gap in shoulder widths. SMALLER means shoulders
	 * are raised, because they move toward the ears.
	 */
	shoulderGap: number;
	/** 0 = relaxed, 1 = fully shrugged. Drives the synth pitch. */
	lift: number;
	armSpread: [number, number];
	armHeight: [number, number];
	reason: string;
}

export const NO_POSTURE: PostureMetrics = {
	visible: false,
	armsOut: false,
	shoulderGap: 0,
	lift: 0,
	armSpread: [0, 0],
	armHeight: [0, 0],
	reason: "no body",
};

const visible = (p: BodyLandmark | undefined): p is BodyLandmark =>
	!!p && (p.visibility === undefined || p.visibility >= MIN_VISIBILITY);

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * Shoulder height and an arms-out gate.
 *
 * Shoulder height is measured against the ears rather than the hips: in a
 * seated webcam shot the hips are usually out of frame, while the ears are
 * always there. Normalizing by shoulder width keeps it independent of how far
 * away the person is sitting.
 */
export function detectPosture(
	frame: BodyFrame | undefined,
	config: PostureConfig = DEFAULT_POSTURE,
): PostureMetrics {
	const pose = frame?.pose;
	if (!pose) return NO_POSTURE;

	const ls = pose[L_SHOULDER];
	const rs = pose[R_SHOULDER];
	if (!visible(ls) || !visible(rs)) return { ...NO_POSTURE, reason: "shoulders not visible" };

	const shoulderWidth = Math.hypot(ls.x - rs.x, ls.y - rs.y);
	if (shoulderWidth < 1e-4) return { ...NO_POSTURE, reason: "degenerate pose" };

	// Ear-to-shoulder gap, averaged over whichever ears are visible.
	const gaps: number[] = [];
	const le = pose[L_EAR];
	const re = pose[R_EAR];
	if (visible(le)) gaps.push((ls.y - le.y) / shoulderWidth);
	if (visible(re)) gaps.push((rs.y - re.y) / shoulderWidth);
	if (gaps.length === 0) {
		const nose = pose[NOSE];
		if (visible(nose)) gaps.push(((ls.y + rs.y) / 2 - nose.y) / shoulderWidth);
	}
	if (gaps.length === 0) return { ...NO_POSTURE, visible: true, reason: "head not visible" };

	const shoulderGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
	const lift = clamp01(
		(config.gapRelaxed - shoulderGap) / (config.gapRelaxed - config.gapShrugged),
	);

	const minX = Math.min(ls.x, rs.x);
	const maxX = Math.max(ls.x, rs.x);
	const shoulderY = (ls.y + rs.y) / 2;

	const armSpread: [number, number] = [0, 0];
	const armHeight: [number, number] = [0, 0];
	let armsOut = true;
	let reason = "arms out";

	const wrists = [pose[L_WRIST], pose[R_WRIST]];
	for (let i = 0; i < 2; i++) {
		const w = wrists[i];
		if (!visible(w)) {
			armsOut = false;
			reason = "raise both arms to the sides";
			continue;
		}
		armSpread[i] = Math.max(minX - w.x, w.x - maxX) / shoulderWidth;
		armHeight[i] = Math.abs(w.y - shoulderY) / shoulderWidth;
		if (armSpread[i] < config.spreadMin || armHeight[i] > config.heightMax) {
			armsOut = false;
			reason =
				armSpread[i] < config.spreadMin ? "reach further out" : "hold arms at shoulder height";
		}
	}

	return { visible: true, armsOut, shoulderGap, lift, armSpread, armHeight, reason };
}
