/** One note in a pre-composed phrase. */
export interface PhraseNote {
	midi: number;
	/** Offset from the start of the phrase. */
	startMs: number;
	durMs: number;
}

export interface Phrase {
	name: string;
	notes: PhraseNote[];
	/** Total length including the tail of the last note. */
	lengthMs: number;
}

/**
 * Transcribed from the original "On Blast" keyboard clip.
 *
 * Pitch classes were stable across two independent analysis runs; the octaves
 * were not, and raw tracking returned implausible leaps (G4->G5->E5->E4->G3
 * inside 600 ms) that are the classic octave-error failure of harmonic-sum
 * pitch detection. Collapsed into one register accordingly.
 *
 * Onsets fit a 90 BPM grid to within 9 ms mean error: a dotted quarter, a
 * quarter, two eighths, then four sixteenths.
 *
 * The last four notes were quiet in the source (0.27-0.49 relative level) and
 * are the least certain part of the transcription.
 */
export const ON_BLAST_PHRASE: Phrase = {
	name: "on-blast",
	notes: [
		{ midi: 69, startMs: 0, durMs: 410 }, // A4
		{ midi: 67, startMs: 410, durMs: 330 }, // G4
		{ midi: 64, startMs: 840, durMs: 170 }, // E4
		{ midi: 67, startMs: 1010, durMs: 200 }, // G4
		{ midi: 62, startMs: 1210, durMs: 60 }, // D4
		{ midi: 63, startMs: 1270, durMs: 60 }, // D#4 — chromatic passing tone
		{ midi: 67, startMs: 1430, durMs: 60 }, // G4
		{ midi: 65, startMs: 1520, durMs: 80 }, // F4
	],
	lengthMs: 1600,
};
