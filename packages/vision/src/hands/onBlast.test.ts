import { describe, expect, it } from "bun:test";
import { History } from "../util/history";
import { DEFAULT_ON_BLAST, detectOnBlast, OPEN_PALM } from "./onBlast";
import type { Hand, HandFrame } from "./types";

/** A hand whose wrist-to-middle-knuckle distance equals `span`. */
function hand(gesture: string, score: number, span: number): Hand {
	const lm = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
	lm[0] = { x: 0.5, y: 0.5, z: 0 };
	lm[9] = { x: 0.5, y: 0.5 - span, z: 0 };
	return { landmarks: lm, handedness: "Right", gesture, gestureScore: score };
}
const frame = (hands: Hand[]): HandFrame => ({ hands, inferenceMs: 5 });
const emptyHist = () => new History<HandFrame>(120);

// Explicit configs. DEFAULT_ON_BLAST is a tuning knob and is expected to
// change, so these must not depend on whichever way it currently points.
const STRICT = { ...DEFAULT_ON_BLAST, requireApproach: true, approachMin: 1.18, spanMin: 0.15 };
const LENIENT = { ...DEFAULT_ON_BLAST, requireApproach: false, approachMin: 1.18, spanMin: 0.15 };
const BIG = 0.17;
const SMALL = 0.1;

describe("preconditions", () => {
	it("needs a frame with hands", () => {
		expect(detectOnBlast(undefined, emptyHist()).ok).toBe(false);
		expect(detectOnBlast(frame([]), emptyHist()).ok).toBe(false);
	});

	it("needs both hands", () => {
		expect(detectOnBlast(frame([hand(OPEN_PALM, 0.9, BIG)]), emptyHist(), LENIENT).ok).toBe(false);
	});

	it("needs both palms open", () => {
		expect(
			detectOnBlast(
				frame([hand("Closed_Fist", 0.9, BIG), hand("Closed_Fist", 0.9, BIG)]),
				emptyHist(),
				LENIENT,
			).ok,
		).toBe(false);
		expect(
			detectOnBlast(
				frame([hand(OPEN_PALM, 0.9, BIG), hand("Closed_Fist", 0.9, BIG)]),
				emptyHist(),
				LENIENT,
			).ok,
		).toBe(false);
	});

	it("needs confident palm classification", () => {
		expect(
			detectOnBlast(
				frame([hand(OPEN_PALM, 0.2, BIG), hand(OPEN_PALM, 0.2, BIG)]),
				emptyHist(),
				LENIENT,
			).ok,
		).toBe(false);
	});

	it("gates on the smaller palm, so a near hand cannot carry a far one", () => {
		expect(
			detectOnBlast(
				frame([hand(OPEN_PALM, 0.9, 0.3), hand(OPEN_PALM, 0.9, SMALL)]),
				emptyHist(),
				LENIENT,
			).ok,
		).toBe(false);
	});

	it("never fires on resting-size palms whatever the default config", () => {
		expect(
			detectOnBlast(frame([hand(OPEN_PALM, 0.9, 0.05), hand(OPEN_PALM, 0.9, 0.05)]), emptyHist())
				.ok,
		).toBe(false);
	});
});

describe("lenient mode: nearness alone suffices", () => {
	it("fires on static open palms held near the camera", () => {
		expect(
			detectOnBlast(
				frame([hand(OPEN_PALM, 0.9, BIG), hand(OPEN_PALM, 0.9, BIG)]),
				emptyHist(),
				LENIENT,
			).ok,
		).toBe(true);
	});

	it("does not fire when the palms are far away", () => {
		expect(
			detectOnBlast(
				frame([hand(OPEN_PALM, 0.9, SMALL), hand(OPEN_PALM, 0.9, SMALL)]),
				emptyHist(),
				LENIENT,
			).ok,
		).toBe(false);
	});
});

describe("strict mode: motion is required", () => {
	it("does not fire on static palms, however near", () => {
		expect(
			detectOnBlast(
				frame([hand(OPEN_PALM, 0.9, BIG), hand(OPEN_PALM, 0.9, BIG)]),
				emptyHist(),
				STRICT,
			).ok,
		).toBe(false);
	});

	it("fires on a thrust that ends close", () => {
		const h = emptyHist();
		h.push(frame([hand(OPEN_PALM, 0.9, 0.1), hand(OPEN_PALM, 0.9, 0.1)]), 0);
		const m = detectOnBlast(
			frame([hand(OPEN_PALM, 0.9, 0.2), hand(OPEN_PALM, 0.9, 0.2)]),
			h,
			STRICT,
			500,
		);
		expect(m.ok).toBe(true);
		expect(m.approach).toBeCloseTo(2, 2);
		expect(m.reason).toBe("thrust");
	});

	it("does not fire on a thrust that stays far away", () => {
		const h = emptyHist();
		h.push(frame([hand(OPEN_PALM, 0.9, 0.05), hand(OPEN_PALM, 0.9, 0.05)]), 0);
		const m = detectOnBlast(
			frame([hand(OPEN_PALM, 0.9, 0.09), hand(OPEN_PALM, 0.9, 0.09)]),
			h,
			STRICT,
			500,
		);
		expect(m.ok).toBe(false);
		expect(m.reason).toBe("bring hands closer");
	});

	it("releases once the hands stop moving, so a held pose cannot repeat", () => {
		const h = emptyHist();
		h.push(frame([hand(OPEN_PALM, 0.9, 0.2), hand(OPEN_PALM, 0.9, 0.2)]), 0);
		const m = detectOnBlast(
			frame([hand(OPEN_PALM, 0.9, 0.2), hand(OPEN_PALM, 0.9, 0.2)]),
			h,
			STRICT,
			500,
		);
		expect(m.ok).toBe(false);
		expect(m.reason).toBe("thrust them forward");
	});

	it("treats a slow drift as not a thrust", () => {
		const h = emptyHist();
		h.push(frame([hand(OPEN_PALM, 0.9, 0.05), hand(OPEN_PALM, 0.9, 0.05)]), 0);
		expect(
			detectOnBlast(
				frame([hand(OPEN_PALM, 0.9, 0.052), hand(OPEN_PALM, 0.9, 0.052)]),
				h,
				STRICT,
				500,
			).ok,
		).toBe(false);
	});
});
