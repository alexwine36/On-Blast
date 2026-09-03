/**
 * Feature switches.
 *
 * Parked features stay wired but inert, so turning one back on is a one-line
 * change rather than an archaeology exercise.
 */
export interface Features {
	/**
	 * Shoulder-driven melodic synth (body pose -> quantized vocal notes).
	 *
	 * Off: the interaction didn't work in practice and is being rethought.
	 * While off the body model is never loaded, which saves ~5.8 MB of
	 * download and roughly halves per-frame inference cost.
	 */
	shoulderSynth: boolean;
}

export const DEFAULT_FEATURES: Features = {
	shoulderSynth: false,
};
