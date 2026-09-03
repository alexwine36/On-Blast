import { describe, expect, it } from "bun:test";
import { gridSeconds, TempoGate } from "./tempo";

describe("gridSeconds", () => {
	it("converts bpm and division to a step length", () => {
		expect(gridSeconds(100, 16)).toBeCloseTo(0.15, 9);
		expect(gridSeconds(120, 16)).toBeCloseTo(0.125, 9);
		expect(gridSeconds(100, 8)).toBeCloseTo(0.3, 9);
		expect(gridSeconds(100, 4)).toBeCloseTo(0.6, 9);
	});
});

describe("TempoGate", () => {
	it("snaps a request forward to the next grid line", () => {
		expect(new TempoGate(0.15).request(0.02)).toBeCloseTo(0.15, 9);
	});

	it("schedules on the line when the request is already on it", () => {
		expect(new TempoGate(0.15).request(0.3)).toBeCloseTo(0.3, 9);
	});

	it("allows only one change per grid step", () => {
		const g = new TempoGate(0.15);
		g.request(0.02);
		expect(g.request(0.05)).toBeNull();
		expect(g.request(0.149)).toBeNull();
		expect(g.request(0.16)).toBeCloseTo(0.3, 9);
	});

	it("caps a fast sweep at the grid rate", () => {
		// Without the gate this would emit a note on every pose update.
		const g = new TempoGate(0.15);
		let fired = 0;
		for (let t = 0; t < 3.0; t += 1 / 60) if (g.request(t) !== null) fired++;
		expect(fired).toBe(20);
	});

	it("never delays requests that arrive slower than the grid", () => {
		const g = new TempoGate(0.15);
		for (const t of [0.0, 0.5, 1.0, 1.5]) expect(g.request(t)).not.toBeNull();
	});

	it("re-opens immediately after reset", () => {
		const g = new TempoGate(0.15);
		g.request(0.02);
		g.reset();
		expect(g.request(0.03)).not.toBeNull();
	});
});
