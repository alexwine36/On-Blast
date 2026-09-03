/**
 * The "ON BLAST" punch-in.
 *
 * Rendered with a changing `key` so React remounts it on every hit and the CSS
 * animation replays from the start — re-triggering an animation on a live
 * element otherwise requires forcing a reflow.
 */
export function HitOverlay() {
  return (
    <div className="hit" aria-live="polite">
      <div className="hit__card">
        <span className="hit__text">ON BLAST</span>
      </div>
    </div>
  );
}
