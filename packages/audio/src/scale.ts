/** Semitone offsets from the root. Pentatonics have no half-step clashes, so
 *  any note lands consonantly no matter where the shoulders stop. */
export const SCALES = {
	minorPentatonic: [0, 3, 5, 7, 10],
	majorPentatonic: [0, 2, 4, 7, 9],
	minor: [0, 2, 3, 5, 7, 8, 10],
	major: [0, 2, 4, 5, 7, 9, 11],
} as const;

export type ScaleName = keyof typeof SCALES;

const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export const midiToFreq = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

export function noteName(midi: number): string {
	return `${NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

/** Builds the ladder of MIDI notes the shoulders move through. */
export function buildScale(rootMidi: number, octaves: number, scale: ScaleName): number[] {
	const offsets = SCALES[scale];
	const notes: number[] = [];
	for (let o = 0; o < octaves; o++) {
		for (const semi of offsets) notes.push(rootMidi + o * 12 + semi);
	}
	notes.push(rootMidi + octaves * 12); // close on the root an octave up
	return notes;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * Maps a continuous 0..1 control to a note index, with hysteresis.
 *
 * A plain `round()` chatters: when the input sits near a boundary, tiny jitter
 * flips the note back and forth many times a second. Requiring the input to
 * travel `deadband` steps away from the *current* note before changing turns
 * that into a clean step.
 */
export class NoteQuantizer {
	private index: number;

	constructor(
		private readonly count: number,
		private readonly deadband = 0.6,
		startIndex = 0,
	) {
		this.index = startIndex;
	}

	select(value01: number): number {
		const exact = clamp01(value01) * (this.count - 1);
		if (Math.abs(exact - this.index) >= this.deadband) {
			this.index = Math.max(0, Math.min(this.count - 1, Math.round(exact)));
		}
		return this.index;
	}

	get current(): number {
		return this.index;
	}

	reset(index = 0): void {
		this.index = index;
	}
}

// ---- Camelot wheel ---------------------------------------------------------
// Harmonic-mixing notation: the number is position on the circle of fifths,
// B is the major key and A its relative minor. Encoded as a table rather than
// converted by hand at each call site, because an off-by-one here is a wrong
// key that still sounds plausible.

export type CamelotCode =
	| "1A"
	| "1B"
	| "2A"
	| "2B"
	| "3A"
	| "3B"
	| "4A"
	| "4B"
	| "5A"
	| "5B"
	| "6A"
	| "6B"
	| "7A"
	| "7B"
	| "8A"
	| "8B"
	| "9A"
	| "9B"
	| "10A"
	| "10B"
	| "11A"
	| "11B"
	| "12A"
	| "12B";

export interface CamelotKey {
	/** 0 = C, 1 = C#, … 11 = B. */
	pitchClass: number;
	mode: "major" | "minor";
	name: string;
}

export const CAMELOT: Record<CamelotCode, CamelotKey> = {
	"1B": { pitchClass: 11, mode: "major", name: "B major" },
	"1A": { pitchClass: 8, mode: "minor", name: "G# minor" },
	"2B": { pitchClass: 6, mode: "major", name: "F# major" },
	"2A": { pitchClass: 3, mode: "minor", name: "D# minor" },
	"3B": { pitchClass: 1, mode: "major", name: "Db major" },
	"3A": { pitchClass: 10, mode: "minor", name: "Bb minor" },
	"4B": { pitchClass: 8, mode: "major", name: "Ab major" },
	"4A": { pitchClass: 5, mode: "minor", name: "F minor" },
	"5B": { pitchClass: 3, mode: "major", name: "Eb major" },
	"5A": { pitchClass: 0, mode: "minor", name: "C minor" },
	"6B": { pitchClass: 10, mode: "major", name: "Bb major" },
	"6A": { pitchClass: 7, mode: "minor", name: "G minor" },
	"7B": { pitchClass: 5, mode: "major", name: "F major" },
	"7A": { pitchClass: 2, mode: "minor", name: "D minor" },
	"8B": { pitchClass: 0, mode: "major", name: "C major" },
	"8A": { pitchClass: 9, mode: "minor", name: "A minor" },
	"9B": { pitchClass: 7, mode: "major", name: "G major" },
	"9A": { pitchClass: 4, mode: "minor", name: "E minor" },
	"10B": { pitchClass: 2, mode: "major", name: "D major" },
	"10A": { pitchClass: 11, mode: "minor", name: "B minor" },
	"11B": { pitchClass: 9, mode: "major", name: "A major" },
	"11A": { pitchClass: 6, mode: "minor", name: "F# minor" },
	"12B": { pitchClass: 4, mode: "major", name: "E major" },
	"12A": { pitchClass: 1, mode: "minor", name: "C# minor" },
};

/** Keys that mix harmonically with `code`: itself, both neighbours, and its relative. */
export function compatibleKeys(code: CamelotCode): CamelotCode[] {
	const num = parseInt(code, 10);
	const letter = code.slice(-1) as "A" | "B";
	const wrap = (n: number) => ((n - 1 + 12) % 12) + 1;
	return [
		code,
		`${wrap(num - 1)}${letter}` as CamelotCode,
		`${wrap(num + 1)}${letter}` as CamelotCode,
		`${num}${letter === "A" ? "B" : "A"}` as CamelotCode,
	];
}

/**
 * MIDI root for a Camelot key in a given octave.
 * Octave numbering follows the MIDI convention where C4 = 60.
 */
export function camelotRootMidi(code: CamelotCode, octave: number): number {
	return CAMELOT[code].pitchClass + (octave + 1) * 12;
}

/** The scale to use for a Camelot key. Pentatonic drops the notes most likely
 *  to clash (the 4th and 7th in major), so any landing point stays consonant. */
export function camelotScaleName(code: CamelotCode, pentatonic = true): ScaleName {
	const major = CAMELOT[code].mode === "major";
	if (pentatonic) return major ? "majorPentatonic" : "minorPentatonic";
	return major ? "major" : "minor";
}
