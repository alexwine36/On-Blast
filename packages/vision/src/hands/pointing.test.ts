import { describe, expect, it } from "bun:test";
import { detectPointing, POINTING_UP, toUserHand } from "./pointing";
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

	it("fires on either hand", () => {
		for (const [label, expected] of [
			[RIGHT_HAND_LABEL, "right"],
			[LEFT_HAND_LABEL, "left"],
		] as const) {
			const m = detectPointing(frame([hand(POINTING_UP, 0.9, label)]));
			expect(m.ok).toBe(true);
			expect(m.reason).toBe("pointing");
			// Reported for the HUD, but not gated on.
			expect(m.hand).toBe(expected);
		}
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

	it("still fires when the non-pointing hand is the other one", () => {
		const m = detectPointing(
			frame([hand(POINTING_UP, 0.8, LEFT_HAND_LABEL), hand("Closed_Fist", 0.99, RIGHT_HAND_LABEL)]),
		);
		expect(m.ok).toBe(true);
		expect(m.hand).toBe("left");
	});

	it("reports the raw label so a swap is diagnosable", () => {
		expect(detectPointing(frame([hand(POINTING_UP, 0.9, RIGHT_HAND_LABEL)])).rawHandedness).toBe(
			"Left",
		);
	});
});
