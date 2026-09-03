import { describe, expect, it } from "bun:test";
import type { CamelotCode } from "./scale";
import {
	buildScale,
	CAMELOT,
	camelotRootMidi,
	camelotScaleName,
	compatibleKeys,
	midiToFreq,
	NoteQuantizer,
	noteName,
} from "./scale";

describe("note maths", () => {
	it("maps midi to frequency", () => {
		expect(midiToFreq(69)).toBeCloseTo(440, 6);
		expect(midiToFreq(45)).toBeCloseTo(110, 6);
	});

	it("names notes with the right octave", () => {
		expect([noteName(45), noteName(60), noteName(69)]).toEqual(["A2", "C4", "A4"]);
	});
});

describe("buildScale", () => {
	it("spans the requested octaves and closes on the root", () => {
		const s = buildScale(45, 2, "minorPentatonic");
		expect(s).toHaveLength(11);
		expect(s[0]).toBe(45);
		expect(s[s.length - 1]).toBe(45 + 24);
	});

	it("leaves no semitone clashes in a pentatonic", () => {
		const s = buildScale(45, 2, "minorPentatonic");
		expect(s.every((n, i) => i === 0 || n - s[i - 1] >= 2)).toBe(true);
	});
});

describe("NoteQuantizer hysteresis", () => {
	it("holds the current note through small jitter", () => {
		const q = new NoteQuantizer(11, 0.6);
		expect(q.select(0)).toBe(0);
		expect(q.select(0.04)).toBe(0);
		expect(q.select(0.055)).toBe(0);
	});

	it("steps once the control travels past the deadband", () => {
		const q = new NoteQuantizer(11, 0.6);
		q.select(0);
		expect(q.select(0.07)).toBe(1);
		expect(q.select(0.06)).toBe(1); // jitter back does not step down
		expect(q.select(0.035)).toBe(0);
	});

	it("does not flip when the input dithers on a boundary", () => {
		// A plain round() chatters here, which sounds far worse than a glide.
		const q = new NoteQuantizer(11, 0.6);
		q.select(0.5);
		let prev = q.current;
		let flips = 0;
		for (let i = 0; i < 200; i++) {
			const n = q.select(0.5 + (i % 2 ? 0.012 : -0.012));
			if (n !== prev) flips++;
			prev = n;
		}
		expect(flips).toBe(0);
	});

	it("lands directly on a distant note rather than creeping", () => {
		expect(new NoteQuantizer(11, 0.6).select(0.8)).toBe(8);
	});

	it("clamps outside 0..1", () => {
		const q = new NoteQuantizer(11, 0.6);
		expect(q.select(5)).toBe(10);
		expect(q.select(-5)).toBe(0);
	});
});

describe("Camelot wheel", () => {
	it("maps the codes we rely on", () => {
		expect(CAMELOT["8B"].name).toBe("C major");
		expect(CAMELOT["8A"].name).toBe("A minor");
		expect(camelotRootMidi("8B", 3)).toBe(48); // C3
		expect(camelotScaleName("8B", true)).toBe("majorPentatonic");
		expect(camelotScaleName("8A", true)).toBe("minorPentatonic");
		expect(camelotScaleName("8B", false)).toBe("major");
	});

	it("reports harmonically compatible keys, wrapping the wheel", () => {
		const eightB: CamelotCode[] = ["7B", "8A", "8B", "9B"];
		expect(compatibleKeys("8B").sort()).toEqual(eightB);
		const wrapHigh: CamelotCode[] = ["11B", "12A", "12B", "1B"];
		expect(compatibleKeys("12B").sort()).toEqual(wrapHigh.sort());
		const wrapLow: CamelotCode[] = ["12A", "1A", "1B", "2A"];
		expect(compatibleKeys("1A").sort()).toEqual(wrapLow.sort());
	});

	it("places every relative minor a minor third below its major", () => {
		const codes = Object.keys(CAMELOT) as CamelotCode[];
		const bad = codes
			.filter((c) => c.endsWith("B"))
			.filter((b) => {
				const a = `${b.slice(0, -1)}A` as CamelotCode;
				return (CAMELOT[b].pitchClass - 3 + 12) % 12 !== CAMELOT[a].pitchClass;
			});
		expect(bad).toEqual([]);
	});

	it("advances by fifths as the number increases", () => {
		const bad: string[] = [];
		for (let n = 1; n <= 12; n++) {
			const here = CAMELOT[`${n}B` as CamelotCode].pitchClass;
			const next = CAMELOT[`${(n % 12) + 1}B` as CamelotCode].pitchClass;
			if ((here + 7) % 12 !== next) bad.push(`${n}B`);
		}
		expect(bad).toEqual([]);
	});

	it("yields an accidental-free ladder for C major", () => {
		const notes = buildScale(camelotRootMidi("8B", 3), 2, camelotScaleName("8B", true));
		expect(notes.every((m) => !noteName(m).includes("#"))).toBe(true);
		expect([noteName(notes[0]), noteName(notes[notes.length - 1])]).toEqual(["C3", "C5"]);
	});
});
