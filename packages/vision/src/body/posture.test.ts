import { describe, expect, it } from "bun:test";
import { DEFAULT_POSTURE as CFG, detectPosture } from "./posture";
import type { BodyFrame, BodyLandmark } from "./types";

// Shoulders at y=0.5, x=0.4/0.6 -> shoulder width 0.2, the normalising unit.
const SW = 0.2;
const SY = 0.5;
const LX = 0.4;
const RX = 0.6;

function pose(opts: {
	gap?: number;
	wristX?: [number, number];
	wristY?: [number, number];
	ears?: boolean;
}): BodyFrame {
	const lm: BodyLandmark[] = Array.from({ length: 33 }, () => ({
		x: 0,
		y: 0,
		z: 0,
		visibility: 0,
	}));
	const put = (i: number, x: number, y: number) => {
		lm[i] = { x, y, z: 0, visibility: 1 };
	};
	put(11, LX, SY);
	put(12, RX, SY);
	if (opts.ears !== false) {
		const earY = SY - (opts.gap ?? CFG.gapRelaxed) * SW;
		put(7, LX, earY);
		put(8, RX, earY);
	}
	if (opts.wristX) {
		put(15, opts.wristX[0], opts.wristY?.[0] ?? SY);
		put(16, opts.wristX[1], opts.wristY?.[1] ?? SY);
	}
	return { pose: lm, inferenceMs: 5 };
}

describe("visibility", () => {
	it("reports nothing without a body", () => {
		expect(detectPosture(undefined).visible).toBe(false);
	});

	it("needs a head to measure shoulder height against", () => {
		// Hips are usually out of frame in a seated webcam shot, so ears are
		// the reference; without them there is nothing to measure.
		expect(detectPosture(pose({ ears: false })).reason).toBe("head not visible");
	});
});

describe("shoulder lift", () => {
	it("reads 0 when relaxed and 1 when fully shrugged", () => {
		expect(detectPosture(pose({ gap: CFG.gapRelaxed })).lift).toBeCloseTo(0, 2);
		expect(detectPosture(pose({ gap: CFG.gapShrugged })).lift).toBeCloseTo(1, 2);
	});

	it("is linear between the extremes", () => {
		const mid = (CFG.gapRelaxed + CFG.gapShrugged) / 2;
		expect(detectPosture(pose({ gap: mid })).lift).toBeCloseTo(0.5, 2);
	});

	it("clamps past both ends", () => {
		expect(detectPosture(pose({ gap: CFG.gapShrugged - 0.3 })).lift).toBe(1);
		expect(detectPosture(pose({ gap: CFG.gapRelaxed + 0.3 })).lift).toBe(0);
	});
});

describe("arms-out gate", () => {
	it("is closed without wrists", () => {
		expect(detectPosture(pose({})).armsOut).toBe(false);
	});

	it("is closed with arms down at the sides", () => {
		expect(detectPosture(pose({ wristX: [LX, RX], wristY: [SY + 0.3, SY + 0.3] })).armsOut).toBe(
			false,
		);
	});

	it("opens with both arms out at shoulder height", () => {
		const out = detectPosture(pose({ wristX: [0.22, 0.78] }));
		expect(out.armsOut).toBe(true);
		expect(out.armSpread[0]).toBeCloseTo(0.9, 2);
	});

	it("is closed when the arms are overhead", () => {
		expect(
			detectPosture(pose({ wristX: [0.22, 0.78], wristY: [SY - 0.25, SY - 0.25] })).armsOut,
		).toBe(false);
	});

	it("needs both arms, not one", () => {
		expect(detectPosture(pose({ wristX: [0.22, RX], wristY: [SY, SY] })).armsOut).toBe(false);
	});
});

describe("scale invariance", () => {
	it("gives the same result for the same posture at half size", () => {
		const near = detectPosture(pose({ wristX: [0.22, 0.78] }));
		const src = pose({ wristX: [0.22, 0.78] }).pose;
		if (!src) throw new Error("expected a pose");
		const far = detectPosture({
			inferenceMs: 5,
			pose: src.map((p) =>
				p.visibility ? { ...p, x: 0.5 + (p.x - 0.5) / 2, y: 0.5 + (p.y - 0.5) / 2 } : p,
			),
		});
		expect(far.armsOut).toBe(near.armsOut);
		expect(far.lift).toBeCloseTo(near.lift, 3);
		expect(SW).toBe(0.2); // the normalising unit the fixtures assume
	});
});
