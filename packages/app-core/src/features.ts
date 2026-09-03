/**
 * Feature switches.
 *
 * Parked features stay wired but inert, so turning one back on is a one-line
 * change rather than an archaeology exercise.
 */
export interface Features {
	/**
	 * Outstretched arms trigger the pre-composed phrase transcribed from the
	 * original clip.
	 *
	 * Replaces the earlier shoulder-height synth, which tracked continuously
	 * and never felt musical. Needs the body pose model.
	 */
	armPhrase: boolean;
}

export const DEFAULT_FEATURES: Features = {
	armPhrase: true,
};
