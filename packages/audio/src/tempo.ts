/** Seconds per grid step, e.g. division 16 = a sixteenth note. */
export function gridSeconds(bpm: number, division: number): number {
	return (60 / bpm) * (4 / division);
}

/**
 * Rate-limits note changes onto a musical grid.
 *
 * Shoulders move continuously, so without this a slow sweep still produces
 * whatever note-change rate the pose loop happens to run at — which sounds
 * like stumbling rather than playing. Changes are snapped forward to the next
 * grid line and capped at one per step.
 */
export class TempoGate {
	private nextAllowed = -Infinity;

	constructor(private readonly gridSec: number) {}

	/**
	 * Ask to change note at `now` (audio-clock seconds).
	 * Returns the time to schedule at, or null if this change must wait.
	 */
	request(now: number): number | null {
		const grid = Math.ceil(now / this.gridSec) * this.gridSec;
		if (grid < this.nextAllowed) return null;
		this.nextAllowed = grid + this.gridSec;
		return grid;
	}

	reset(): void {
		this.nextAllowed = -Infinity;
	}
}
