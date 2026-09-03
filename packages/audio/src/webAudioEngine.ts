import type { Phrase } from "./phrase";
import type { CamelotCode } from "./scale";
import {
	buildScale,
	CAMELOT,
	camelotRootMidi,
	camelotScaleName,
	midiToFreq,
	NoteQuantizer,
	noteName,
} from "./scale";
import { gridSeconds, TempoGate } from "./tempo";
import type { AudioEngine, AudioStatus } from "./types";

/**
 * Musical key, in Camelot terms so it lines up with harmonic mixing.
 * 8B = C major.
 */
export const KEY: CamelotCode = "8B";
/**
 * Lowest octave of the ladder; C4 with KEY = 8B.
 *
 * Centred on the vocal sample's own pitch (A4) so playback rates stay between
 * 0.6x and 1.2x. Transposing a voice much further than that stops sounding
 * like a voice and starts sounding like tape speed.
 */
const SCALE_OCTAVE = 4;
const SCALE_OCTAVES = 1;
/** Pentatonic omits the 4th and 7th, the two degrees most likely to clash. */
const PENTATONIC = true;

const SCALE_ROOT_MIDI = camelotRootMidi(KEY, SCALE_OCTAVE);
const SCALE_NAME = camelotScaleName(KEY, PENTATONIC);
/** How far the control must travel past a note before it changes. */
const NOTE_DEADBAND = 0.6;
const VOICE_LEVEL = 0.16;

/**
 * Note changes are quantised to this grid. Without it, a shoulder sweep fires
 * a note on every pose update.
 */
export const TEMPO_BPM = 100;
/** 16 = sixteenth notes, 8 = eighths, 4 = quarters. */
export const NOTE_DIVISION = 16;

/**
 * Re-attack applied on each note change.
 *
 * A big overshoot on a *sustained* voice reads as lurching, not playing — the
 * note is already sounding, so this only needs to mark the change, not
 * restart it.
 */
const ARTICULATION = {
	overshoot: 1.06,
	attackSec: 0.008,
	settleTau: 0.035,
};

/**
 * Sample URLs, passed in rather than hardcoded.
 *
 * A project site is served from a subpath, so an absolute "/audio/..." would
 * resolve against the domain root and 404 — and only in production, since
 * both local dev and Tauri serve from "/".
 */
export interface AudioEngineOptions {
	/** The punchline hit. Null falls back to the synthesized sting. */
	stingUrl?: string | null;
	/**
	 * A sustained vowel lifted from the "On Blast" vocal and looped seamlessly
	 * (period-aligned, crossfaded). Every note is this grain retuned, which is
	 * the only way to keep vocal character — no oscillator stack reproduces
	 * formants. Null falls back to the oscillator voice.
	 */
	voiceUrl?: string | null;
}
/** Measured pitch of that grain; the reference for every transposition. */
const VOICE_BASE_FREQ = 440; // A4

export function createWebAudioEngine({
	stingUrl = null,
	voiceUrl = null,
}: AudioEngineOptions = {}): AudioEngine {
	const ctx = new AudioContext();
	const master = ctx.createGain();
	master.gain.value = 0.7;
	// Safety limiter: the synth stack and any future sample both land here, and
	// a sting that clips sounds cheap.
	const limiter = ctx.createDynamicsCompressor();
	limiter.threshold.value = -6;
	limiter.knee.value = 0;
	limiter.ratio.value = 20;
	limiter.attack.value = 0.002;
	limiter.release.value = 0.15;
	master.connect(limiter);
	limiter.connect(ctx.destination);

	let sample: AudioBuffer | null = null;
	if (stingUrl) {
		void fetch(stingUrl)
			.then((r) => r.arrayBuffer())
			.then((b) => ctx.decodeAudioData(b))
			.then((buf) => {
				sample = buf;
			})
			.catch((err) => console.error("[audio] sting sample failed to load", err));
	}

	// ---- Shoulder voice ---------------------------------------------------
	// Quantized to the key's ladder and stepped, not glided. A continuous
	// portamento is exactly what makes a theremin sound like a theremin;
	// discrete notes with a short re-attack read as being played.
	const NOTES = buildScale(SCALE_ROOT_MIDI, SCALE_OCTAVES, SCALE_NAME);
	const quantizer = new NoteQuantizer(NOTES.length, NOTE_DEADBAND);
	const tempoGate = new TempoGate(gridSeconds(TEMPO_BPM, NOTE_DIVISION));

	const voiceGain = ctx.createGain();
	voiceGain.gain.value = 0;
	const voiceFilter = ctx.createBiquadFilter();
	voiceFilter.type = "lowpass";
	voiceFilter.frequency.value = 1200;
	voiceFilter.Q.value = 3;
	voiceGain.connect(voiceFilter);
	voiceFilter.connect(master);

	// Two possible tone sources feed the same envelope. The oscillators are the
	// fallback if the vocal sample fails to load, so the app is never silent.
	const oscBus = ctx.createGain();
	oscBus.gain.value = 1;
	oscBus.connect(voiceGain);
	const sampleBus = ctx.createGain();
	sampleBus.gain.value = 0;
	sampleBus.connect(voiceGain);

	// Triangle carries the body; a quieter saw adds edge so it cuts through.
	const voiceOscs: OscillatorNode[] = [
		{ type: "triangle" as OscillatorType, detune: -4, level: 1 },
		{ type: "sawtooth" as OscillatorType, detune: 6, level: 0.3 },
	].map(({ type, detune, level }) => {
		const osc = ctx.createOscillator();
		osc.type = type;
		osc.detune.value = detune;
		osc.frequency.value = midiToFreq(NOTES[0]);
		const g = ctx.createGain();
		g.gain.value = level;
		osc.connect(g);
		g.connect(oscBus);
		osc.start();
		return osc;
	});

	let voiceActive = false;
	let voiceIndex = -1;
	/** One looping vocal grain whose rate is retuned per note. Kept running
	 *  rather than retriggered, so stepping notes never clicks. */
	let voiceSource: AudioBufferSourceNode | null = null;
	let voiceBuffer: AudioBuffer | null = null;

	if (voiceUrl) {
		void fetch(voiceUrl)
			.then((r) => r.arrayBuffer())
			.then((b) => ctx.decodeAudioData(b))
			.then((buf) => {
				voiceBuffer = buf;
				const src = ctx.createBufferSource();
				src.buffer = buf;
				src.loop = true;
				src.connect(sampleBus);
				src.start();
				voiceSource = src;
				sampleBus.gain.value = 1;
				oscBus.gain.value = 0;
				// The voice carries its own timbre; the synth filter would only dull it.
				voiceFilter.Q.value = 0.7;
				voiceFilter.frequency.setValueAtTime(9000, ctx.currentTime);
			})
			.catch((err) => console.error("[audio] vocal sample failed to load", err));
	}

	/** Step to a note and strike it. */
	function articulate(midi: number, t: number): void {
		const freq = midiToFreq(midi);
		// setValueAtTime, not setTargetAtTime — the step is the point.
		if (voiceSource) {
			voiceSource.playbackRate.setValueAtTime(freq / VOICE_BASE_FREQ, t);
		} else {
			for (const osc of voiceOscs) osc.frequency.setValueAtTime(freq, t);
		}

		// setTargetAtTime moves from wherever the gain currently is, so there is
		// no stale anchor value to read when scheduling ahead of the clock.
		voiceGain.gain.cancelScheduledValues(t);
		voiceGain.gain.setTargetAtTime(
			VOICE_LEVEL * ARTICULATION.overshoot,
			t,
			ARTICULATION.attackSec / 3,
		);
		voiceGain.gain.setTargetAtTime(VOICE_LEVEL, t + ARTICULATION.attackSec, ARTICULATION.settleTau);

		if (!voiceSource) {
			// A filter blip on the attack gives the synth fallback a transient.
			voiceFilter.frequency.cancelScheduledValues(t);
			voiceFilter.frequency.setValueAtTime(Math.min(9000, freq * 9), t);
			voiceFilter.frequency.setTargetAtTime(Math.min(5200, freq * 4), t + 0.014, 0.14);
		}
	}

	/**
	 * Schedule a phrase against the audio clock.
	 *
	 * Every note is placed up front at an absolute time rather than fired from
	 * a timer, so the rhythm is sample-accurate and immune to whatever the
	 * pose loop is doing on the main thread.
	 */
	function playPhrase(phrase: Phrase): void {
		if (ctx.state !== "running") void ctx.resume();
		const t0 = ctx.currentTime + 0.02;

		for (const note of phrase.notes) {
			const start = t0 + note.startMs / 1000;
			const dur = note.durMs / 1000;
			const freq = midiToFreq(note.midi);

			const gain = ctx.createGain();
			gain.gain.setValueAtTime(0.0001, start);
			gain.gain.linearRampToValueAtTime(VOICE_LEVEL * 1.4, start + 0.012);
			gain.gain.setValueAtTime(VOICE_LEVEL * 1.4, start + Math.max(0.02, dur * 0.7));
			// Short release so fast sixteenths stay articulate instead of smearing.
			gain.gain.exponentialRampToValueAtTime(0.0001, start + dur + 0.06);

			const filter = ctx.createBiquadFilter();
			filter.type = "lowpass";
			filter.frequency.value = 9000;
			gain.connect(filter);
			filter.connect(master);

			if (voiceBuffer) {
				const src = ctx.createBufferSource();
				src.buffer = voiceBuffer;
				src.loop = true;
				src.playbackRate.value = freq / VOICE_BASE_FREQ;
				src.connect(gain);
				src.start(start);
				src.stop(start + dur + 0.1);
			} else {
				// Oscillator fallback, so a missing sample never means silence.
				for (const [type, level] of [
					["triangle", 1],
					["sawtooth", 0.3],
				] as const) {
					const osc = ctx.createOscillator();
					osc.type = type;
					osc.frequency.value = freq;
					const g = ctx.createGain();
					g.gain.value = level;
					osc.connect(g);
					g.connect(gain);
					osc.start(start);
					osc.stop(start + dur + 0.1);
				}
			}
		}
	}

	function setTone(active: boolean, pitch: number): void {
		const t = ctx.currentTime;
		if (!active) {
			if (voiceActive) voiceGain.gain.setTargetAtTime(0, t, 0.1);
			voiceActive = false;
			voiceIndex = -1; // so re-arming strikes the note instead of sliding in
			tempoGate.reset();
			return;
		}
		const index = quantizer.select(pitch);
		if (index !== voiceIndex) {
			// Snap forward to the next grid line; null means this step already had
			// its note and the change waits for the next one.
			const at = tempoGate.request(t);
			if (at !== null) {
				voiceIndex = index;
				articulate(NOTES[index], at);
			}
		}
		voiceActive = true;
	}

	function playSample(buffer: AudioBuffer): void {
		const src = ctx.createBufferSource();
		src.buffer = buffer;
		src.connect(master);
		src.start();
	}

	/**
	 * Synthesized sting, matched to the source by additive synthesis.
	 *
	 * Measured from the reference: an A power chord (A2-E3-A3 with octaves, no
	 * third), 10 ms attack, sustaining ~390 ms rather than decaying, and very
	 * dark — only 0.3% of its energy sits above 4 kHz. Partial levels below are
	 * the measured ones, so the spectrum matches by construction rather than by
	 * ear-guessing an oscillator stack.
	 */
	const STING_PARTIALS: Array<{ freq: number; amp: number }> = [
		{ freq: 110.0, amp: 1.0 }, // A2   0.0 dB
		{ freq: 164.8, amp: 0.427 }, // E3  -7.4
		{ freq: 220.0, amp: 0.556 }, // A3  -5.1
		{ freq: 329.6, amp: 0.072 }, // E4 -22.9
		{ freq: 440.0, amp: 0.086 }, // A4 -21.3
		{ freq: 659.3, amp: 0.376 }, // E5  -8.5
		{ freq: 880.0, amp: 0.214 }, // A5 -13.4
		{ freq: 1318.5, amp: 0.092 }, // E6 -20.7
	];

	const STING_ATTACK = 0.0015;
	const STING_SUSTAIN = 0.37;
	const STING_TAIL = 0.02;
	/** Beat offset in Hz, not cents — cents make upper partials beat fast enough
	 *  to cancel themselves out. */
	const STING_BEAT_HZ = 0.6;
	/**
	 * Soft-clip drive. This is where the grunge comes from: saturating the summed
	 * chord generates intermodulation across 1-6 kHz. A clean additive stack has
	 * none, which measured as literally 0% of its energy above 1.6 kHz against
	 * the reference's 9.8%.
	 */
	const STING_DRIVE = 9;

	/** tanh soft-clip. Saturates rather than hard-clipping, so it grits up
	 *  instead of buzzing. */
	function distortionCurve(drive: number): Float32Array {
		const n = 2048;
		const curve = new Float32Array(n);
		for (let i = 0; i < n; i++) {
			const x = (i * 2) / n - 1;
			curve[i] = Math.tanh(x * drive) / Math.tanh(drive);
		}
		return curve;
	}

	function noiseBuffer(seconds: number): AudioBuffer {
		const len = Math.floor(ctx.sampleRate * seconds);
		const buf = ctx.createBuffer(1, len, ctx.sampleRate);
		const data = buf.getChannelData(0);
		for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
		return buf;
	}

	/**
	 * Three layers, because an impact is not one sound: a saturated chord for
	 * the note, a filtered noise burst for the crack, and a pitch-dropping sine
	 * for the weight underneath.
	 */
	function playSynthSting(): void {
		const t0 = ctx.currentTime + 0.005;
		const end = t0 + STING_ATTACK + STING_SUSTAIN + STING_TAIL;

		// ---- chord, driven into saturation ----
		// Constant level into the distortion; dynamics are applied afterwards.
		const chord = ctx.createGain();
		chord.gain.value = 1;
		// Post-distortion envelope. Placing it before the shaper lets saturation
		// flatten the attack, which is fatal for a percussive hit.
		const chordEnv = ctx.createGain();
		chordEnv.gain.value = 0.0001;

		const drive = ctx.createGain();
		drive.gain.value = 2.2;
		const shaper = ctx.createWaveShaper();
		shaper.curve = distortionCurve(STING_DRIVE);
		shaper.oversample = "4x";
		// Push the 1-2 kHz bite the reference has and the clean stack lacked.
		const bite = ctx.createBiquadFilter();
		bite.type = "peaking";
		bite.frequency.value = 1400;
		bite.Q.value = 0.9;
		bite.gain.value = 3.5;
		const air = ctx.createBiquadFilter();
		air.type = "highshelf";
		air.frequency.value = 3000;
		air.gain.value = 9;
		const body = ctx.createBiquadFilter();
		body.type = "lowpass";
		body.frequency.value = 9500;
		body.Q.value = 0.6;

		// Lift 200-400 Hz, where the reference carries more weight than the
		// saturated stack does on its own.
		const lowMid = ctx.createBiquadFilter();
		lowMid.type = "peaking";
		lowMid.frequency.value = 300;
		lowMid.Q.value = 0.8;
		lowMid.gain.value = 3;

		chord.connect(drive);
		drive.connect(shaper);
		shaper.connect(bite);
		bite.connect(lowMid);
		lowMid.connect(air);
		air.connect(body);
		body.connect(chordEnv);
		chordEnv.connect(master);

		chordEnv.gain.setValueAtTime(0.0001, t0);
		chordEnv.gain.linearRampToValueAtTime(1.0, t0 + 0.006);
		// Hard drop off the hit. The reference's sustain sits at ~36% of its peak;
		// anything flatter reads as a held chord rather than an impact.
		chordEnv.gain.exponentialRampToValueAtTime(0.16, t0 + 0.04);
		chordEnv.gain.linearRampToValueAtTime(0.1, t0 + STING_ATTACK + STING_SUSTAIN);
		chordEnv.gain.linearRampToValueAtTime(0.0001, end);

		for (const { freq, amp } of STING_PARTIALS) {
			for (const offset of [-STING_BEAT_HZ, STING_BEAT_HZ]) {
				const osc = ctx.createOscillator();
				osc.type = "sine";
				osc.frequency.value = freq + offset;
				const g = ctx.createGain();
				g.gain.value = amp * 0.5;
				osc.connect(g);
				g.connect(chord);
				osc.start(t0);
				osc.stop(end + 0.02);
			}
		}

		// ---- transient crack: the "P" of POW ----
		const crack = ctx.createBufferSource();
		crack.buffer = noiseBuffer(0.09);
		const crackFilter = ctx.createBiquadFilter();
		crackFilter.type = "bandpass";
		crackFilter.frequency.value = 4200;
		crackFilter.Q.value = 0.5;
		const crackGain = ctx.createGain();
		crackGain.gain.setValueAtTime(0.9, t0);
		crackGain.gain.exponentialRampToValueAtTime(0.06, t0 + 0.03);
		crackGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.11);
		crack.connect(crackFilter);
		crackFilter.connect(crackGain);
		crackGain.connect(master);
		crack.start(t0);
		crack.stop(t0 + 0.1);

		// ---- low thump: the weight behind the hit ----
		const thump = ctx.createOscillator();
		thump.type = "sine";
		thump.frequency.setValueAtTime(150, t0);
		thump.frequency.exponentialRampToValueAtTime(55, t0 + 0.07);
		const thumpGain = ctx.createGain();
		thumpGain.gain.setValueAtTime(0.0001, t0);
		thumpGain.gain.linearRampToValueAtTime(0.5, t0 + 0.004);
		thumpGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
		thump.connect(thumpGain);
		thumpGain.connect(master);
		thump.start(t0);
		thump.stop(t0 + 0.2);
	}

	return {
		get toneSource(): "sample" | "synth" {
			return voiceSource ? "sample" : "synth";
		},
		get tempoLabel(): string {
			return `${TEMPO_BPM} BPM 1/${NOTE_DIVISION}`;
		},
		get keyName(): string {
			return `${CAMELOT[KEY].name} (${KEY})`;
		},
		get currentNote(): string | null {
			return voiceActive && voiceIndex >= 0 ? noteName(NOTES[voiceIndex]) : null;
		},
		get source(): "sample" | "synth" {
			return sample ? "sample" : "synth";
		},
		get status(): AudioStatus {
			if (ctx.state === "running") return "ready";
			return ctx.state === "suspended" ? "blocked" : "idle";
		},
		async unlock() {
			if (ctx.state !== "running") await ctx.resume();
		},
		setTone,
		playPhrase,
		playSting() {
			if (ctx.state !== "running") void ctx.resume();
			if (sample) playSample(sample);
			else playSynthSting();
		},
		dispose() {
			try {
				voiceSource?.stop();
			} catch {
				// already stopped
			}
			for (const osc of voiceOscs) {
				try {
					osc.stop();
				} catch {
					// already stopped
				}
			}
			void ctx.close();
		},
	};
}
