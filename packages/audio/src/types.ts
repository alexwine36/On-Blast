import type { Phrase } from "./phrase";

export type AudioStatus = "idle" | "blocked" | "ready";

/**
 * The seam between gestures and sound.
 *
 * Web Audio lives in the same context as the keypoints, so a trigger reaches
 * the speakers without an IPC hop; once a sound is started its timing is
 * sample-accurate on the audio thread. Swapping in a native (Rust) backend
 * later means implementing this interface.
 */
export interface AudioEngine {
	readonly status: AudioStatus;
	/** "sample" once the sting file decoded, "synth" while falling back to it. */
	readonly source: "sample" | "synth";
	/** Browsers start audio suspended until a user gesture; call from a click. */
	unlock(): Promise<void>;
	/** The punchline hit. */
	playSting(): void;
	/**
	 * The shoulder-driven voice. `pitch` is 0..1 (shoulders down..up), quantized
	 * to a musical scale rather than swept. Safe to call every frame.
	 */
	setTone(active: boolean, pitch: number): void;
	/** Name of the note currently sounding, e.g. "C4", or null when silent. */
	readonly currentNote: string | null;
	/**
	 * Play a pre-composed phrase, scheduled on the audio clock so its timing
	 * does not depend on frame rate.
	 */
	playPhrase(phrase: Phrase): void;
	/** Musical key of the voice, e.g. "C major (8B)". */
	readonly keyName: string;
	/** Note-change grid, e.g. "100 BPM 1/16". */
	readonly tempoLabel: string;
	/** Whether the shoulder tone is the vocal sample or the synth fallback. */
	readonly toneSource: "sample" | "synth";
	/** Whether the phrase plays the original recording or a note sequence. */
	readonly phraseSource: "clip" | "notes";
	dispose(): void;
}
