export interface Stamped<T> {
	item: T;
	at: number;
}

/**
 * Fixed-size ring buffer of recent items.
 *
 * Gestures like "coming closer" are defined by change over time, not by a
 * single frame, so detection needs a short look-back.
 */
export class History<T> {
	private entries: Stamped<T>[] = [];

	constructor(private readonly capacity = 90) {}

	push(item: T, at = performance.now()): void {
		this.entries.push({ item, at });
		if (this.entries.length > this.capacity) this.entries.shift();
	}

	clear(): void {
		this.entries = [];
	}

	get latest(): Stamped<T> | undefined {
		return this.entries[this.entries.length - 1];
	}

	get length(): number {
		return this.entries.length;
	}

	/** Entries from the last `ms` milliseconds, oldest first. */
	since(ms: number, now = performance.now()): Stamped<T>[] {
		const cutoff = now - ms;
		return this.entries.filter((e) => e.at >= cutoff);
	}

	/** Oldest entry at least `ms` old, for comparing "now" against "then". */
	before(ms: number, now = performance.now()): Stamped<T> | undefined {
		const cutoff = now - ms;
		let found: Stamped<T> | undefined;
		for (const e of this.entries) {
			if (e.at <= cutoff) found = e;
			else break;
		}
		return found;
	}
}
