import { describe, expect, it } from "bun:test";
import { HoldTrigger } from "./holdTrigger";

// The app's tuned values.
const HOLD = 5;
const COOLDOWN = 150;

describe("hold", () => {
	it("never fires on the first true sample", () => {
		expect(new HoldTrigger(250, 2000).update(true, 0).fired).toBe(false);
		expect(new HoldTrigger(250, 2000).update(true, 10_000).fired).toBe(false);
	});

	it("reports progress through the hold window", () => {
		const h = new HoldTrigger(250, 2000);
		h.update(true, 0);
		expect(h.update(true, 125).progress).toBe(0.5);
		expect(h.update(true, 250).fired).toBe(true);
	});

	it("restarts the hold from zero after an interruption", () => {
		const h = new HoldTrigger(250, 2000);
		h.update(true, 0);
		expect(h.update(false, 200).progress).toBe(0);
		expect(h.update(true, 260).fired).toBe(false);
		expect(h.update(true, 460).fired).toBe(false); // restart was at 260
		expect(h.update(true, 510).fired).toBe(true);
	});
});

describe("cooldown", () => {
	it("stays disarmed for the cooldown window", () => {
		const h = new HoldTrigger(250, 2000);
		h.update(true, 0);
		h.update(true, 250); // fires
		expect(h.update(true, 1250).fired).toBe(false);
		expect(h.update(true, 1250).cooldown).toBeGreaterThan(0);
		expect(h.update(true, 2240).fired).toBe(false);
	});

	it("clears the cooldown on reset", () => {
		const h = new HoldTrigger(250, 2000);
		h.update(true, 0);
		h.update(true, 250);
		h.reset();
		expect(h.update(true, 300).cooldown).toBe(0);
		expect(h.update(true, 560).fired).toBe(true);
	});
});

describe("release requirement", () => {
	it("fires once no matter how long the pose is held", () => {
		// Without this, a held pose machine-guns the sting.
		const h = new HoldTrigger(HOLD, COOLDOWN);
		h.update(true, 0);
		expect(h.update(true, 10).fired).toBe(true);
		let extra = 0;
		for (let t = 20; t <= 3000; t += 20) if (h.update(true, t).fired) extra++;
		expect(extra).toBe(0);
	});

	it("re-arms after a release", () => {
		const h = new HoldTrigger(HOLD, COOLDOWN);
		h.update(true, 0);
		h.update(true, 10);
		h.update(false, 3100);
		h.update(true, 3200);
		expect(h.update(true, 3210).fired).toBe(true);
	});

	it("counts a release that happens during the cooldown", () => {
		// Otherwise a quick double-thrust swallows the second hit.
		const h = new HoldTrigger(HOLD, COOLDOWN);
		h.update(true, 0);
		h.update(true, 10);
		h.update(false, 50);
		h.update(true, 200);
		expect(h.update(true, 220).fired).toBe(true);
	});

	it("can be opted out of", () => {
		const h = new HoldTrigger(5, 100, false);
		h.update(true, 0);
		h.update(true, 10);
		let n = 0;
		for (let t = 20; t <= 1000; t += 20) if (h.update(true, t).fired) n++;
		expect(n).toBeGreaterThan(3);
	});
});
