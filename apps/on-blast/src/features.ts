/**
 * Feature switches.
 *
 * Parked features stay wired but inert, so turning one back on is a one-line
 * change rather than an archaeology exercise.
 */

/**
 * Shoulder-driven melodic synth (body pose -> quantized vocal notes).
 *
 * Off: the interaction didn't work in practice and is being rethought. While
 * off, the body model is never loaded at all, which also saves ~5.8 MB of
 * download and roughly halves per-frame inference cost.
 */
export const SHOULDER_SYNTH_ENABLED = false;
