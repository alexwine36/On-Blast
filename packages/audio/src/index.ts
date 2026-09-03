export type { CamelotCode, CamelotKey, ScaleName } from "./scale";
// Musical helpers. Exported because the UI displays the key and note names,
// and because the scale/tempo logic is the part worth testing in isolation.
export {
	buildScale,
	CAMELOT,
	camelotRootMidi,
	camelotScaleName,
	compatibleKeys,
	midiToFreq,
	NoteQuantizer,
	noteName,
	SCALES,
} from "./scale";
export { gridSeconds, TempoGate } from "./tempo";
export type { AudioEngine, AudioStatus } from "./types";
export { createWebAudioEngine, KEY, NOTE_DIVISION, TEMPO_BPM } from "./webAudioEngine";
