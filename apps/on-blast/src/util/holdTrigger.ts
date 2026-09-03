export interface HoldState {
  /** 0..1 progress through the hold window. */
  progress: number;
  /** True only on the frame the threshold is crossed. */
  fired: boolean;
  /** 0..1 progress through the cooldown; 0 when not cooling down. */
  cooldown: number;
}

/**
 * Turns a moment-to-moment boolean into repeatable edges.
 *
 * Three guards: the condition must hold continuously for `holdMs` before
 * firing, so something passing through the trigger position doesn't count;
 * after firing it stays disarmed for `cooldownMs`; and with `requireRelease`
 * the condition must go false again before another hit is possible, so one
 * gesture produces exactly one hit no matter how long it is held.
 *
 * Standalone so the timing rules can be tested without a camera or a React tree.
 */
export class HoldTrigger {
  private since: number | null = null;
  private firedAt: number | null = null;

  private armed = true;

  constructor(
    private readonly holdMs: number,
    private readonly cooldownMs = 0,
    /**
     * Require the condition to go false again before another hit is possible.
     *
     * Without this, a condition that simply stays true re-fires every
     * `cooldownMs` forever. One gesture should be one hit, so the gate has to
     * be released and re-made.
     */
    private readonly requireRelease = true,
  ) {}

  update(ok: boolean, now: number): HoldState {
    // Cooling down: stay disarmed, and force the hold to restart afterwards so
    // simply never letting go doesn't fire the instant the cooldown lapses.
    if (this.firedAt !== null) {
      const elapsed = now - this.firedAt;
      if (elapsed < this.cooldownMs) {
        this.since = null;
        // A release still counts while cooling down — letting go during the
        // cooldown must re-arm, or a quick double-thrust swallows the second.
        if (!ok) this.armed = true;
        return { progress: 0, fired: false, cooldown: 1 - elapsed / this.cooldownMs };
      }
      this.firedAt = null;
    }

    if (!ok) {
      this.since = null;
      this.armed = true; // released — a new gesture can now count
      return { progress: 0, fired: false, cooldown: 0 };
    }

    // Still-held from the previous hit: wait for a release.
    if (this.requireRelease && !this.armed) {
      this.since = null;
      return { progress: 0, fired: false, cooldown: 0 };
    }

    this.since ??= now;
    const held = now - this.since;
    const progress = Math.min(1, held / this.holdMs);
    if (progress >= 1) {
      this.firedAt = now;
      this.since = null;
      this.armed = false;
      return { progress: 1, fired: true, cooldown: 1 };
    }
    return { progress, fired: false, cooldown: 0 };
  }

  reset(): void {
    this.since = null;
    this.firedAt = null;
    this.armed = true;
  }
}
