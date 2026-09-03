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
   * The shoulder-driven drone. `pitch` is 0..1 (shoulders down..up); `active`
   * fades it in and out. Safe to call every frame — changes are smoothed.
   */
  setDrone(active: boolean, pitch: number): void;
  dispose(): void;
}
