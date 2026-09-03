import { describe, expect, it } from "bun:test";
import { DEFAULT_POINTING, detectPointing, POINTING_UP, toUserHand } from "./pointing";
import type { Hand, HandFrame } from "./types";

function hand(gesture: string, score: number, handedness: string): Hand {
	return {
		landmarks: Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 })),
		handedness,
		gesture,
		gestureScore: score,
	};
}
const frame = (hands: Hand[]): HandFrame => ({ hands, inferenceMs: 5 });

// Our capture is the raw camera frame, so MediaPipe's labels are swapped
// relative to the person. "Left" in the image is the person's right hand.
const RIGHT_HAND_LABEL = "Left";
const LEFT_HAND_LABEL = "Right";

describe("toUserHand", () => {
	it("inverts labels for an unmirrored frame", () => {
		expect(toUserHand("Left", false)).toBe("right");
		expect(toUserHand("Right", false)).toBe("left");
	});

	it("passes labels through when the frame is already mirrored", () => {
		expect(toUserHand("Left", true)).toBe("left");
		expect(toUserHand("Right", true)).toBe("right");
	});

	it("does not guess at an unknown label", () => {
		expect(toUserHand("", false)).toBe("unknown");
		expect(toUserHand("Both", false)).toBe("unknown");
	});
});

describe("detectPointing", () => {
	it("needs a frame with hands", () => {
		expect(detectPointing(undefined).ok).toBe(false);
		expect(detectPointing(frame([])).ok).toBe(false);
	});

	it("fires on the right hand pointing up", () => {
		const m = detectPointing(frame([hand(POINTING_UP, 0.9, RIGHT_HAND_LABEL)]));
		expect(m.ok).toBe(true);
		expect(m.hand).toBe("right");
		expect(m.reason).toBe("pointing");
	});

	it("does not fire on the left hand", () => {
		const m = detectPointing(frame([hand(POINTING_UP, 0.9, LEFT_HAND_LABEL)]));
		expect(m.ok).toBe(false);
		expect(m.hand).toBe("left");
		expect(m.reason).toBe("use your right hand");
	});

	it("does not fire on other gestures", () => {
		for (const g of ["Open_Palm", "Closed_Fist", "Victory", "Thumb_Up", "None"]) {
			expect(detectPointing(frame([hand(g, 0.95, RIGHT_HAND_LABEL)])).ok).toBe(false);
		}
	});

	it("rejects a low-confidence point", () => {
		const m = detectPointing(frame([hand(POINTING_UP, 0.2, RIGHT_HAND_LABEL)]));
		expect(m.ok).toBe(false);
		expect(m.reason).toBe("hold the point steady");
	});

	it("picks the pointing hand out of two", () => {
		const m = detectPointing(
			frame([hand("Open_Palm", 0.99, LEFT_HAND_LABEL), hand(POINTING_UP, 0.8, RIGHT_HAND_LABEL)]),
		);
		expect(m.ok).toBe(true);
		expect(m.hand).toBe("right");
	});

	it("honours a hand:any override", () => {
		const cfg = { ...DEFAULT_POINTING, hand: "any" as const };
		expect(detectPointing(frame([hand(POINTING_UP, 0.9, LEFT_HAND_LABEL)]), cfg).ok).toBe(true);
	});

	it("reports the raw label so a swap is diagnosable", () => {
		expect(detectPointing(frame([hand(POINTING_UP, 0.9, RIGHT_HAND_LABEL)])).rawHandedness).toBe(
			"Left",
		);
	});
});
