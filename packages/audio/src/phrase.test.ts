import { describe, expect, it } from "bun:test";
import { ON_BLAST_PHRASE } from "./phrase";
import { noteName } from "./scale";

describe("ON_BLAST_PHRASE", () => {
	it("is the transcribed melody", () => {
		expect(ON_BLAST_PHRASE.notes.map((n) => noteName(n.midi))).toEqual([
			"A4",
			"G4",
			"E4",
			"G4",
			"D4",
			"D#4",
			"G4",
			"F4",
		]);
	});

	it("has monotonically increasing onsets", () => {
		const starts = ON_BLAST_PHRASE.notes.map((n) => n.startMs);
		expect(starts).toEqual([...starts].sort((a, b) => a - b));
	});

	it("fits inside its declared length", () => {
		for (const n of ON_BLAST_PHRASE.notes) {
			expect(n.startMs + n.durMs).toBeLessThanOrEqual(ON_BLAST_PHRASE.lengthMs);
		}
	});

	it("stays within an octave of the A4 sample, so no formant-shift artifacts", () => {
		// Playback rate is midi-relative to A4; much past an octave and a
		// pitch-shifted sample stops sounding like the instrument.
		for (const n of ON_BLAST_PHRASE.notes) {
			expect(Math.abs(n.midi - 69)).toBeLessThanOrEqual(12);
		}
	});

	it("is all in C major except the one chromatic passing tone", () => {
		const cMajor = new Set([0, 2, 4, 5, 7, 9, 11]);
		const outside = ON_BLAST_PHRASE.notes.filter((n) => !cMajor.has(n.midi % 12));
		expect(outside.map((n) => noteName(n.midi))).toEqual(["D#4"]);
	});

	it("has no overlapping notes, so it is monophonic", () => {
		const ns = ON_BLAST_PHRASE.notes;
		for (let i = 1; i < ns.length; i++) {
			expect(ns[i].startMs).toBeGreaterThanOrEqual(ns[i - 1].startMs + ns[i - 1].durMs - 1);
		}
	});
});
