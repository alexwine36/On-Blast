import type { PoseStats } from "../hooks/usePoseLoop";

interface StatsHudProps {
  stats: PoseStats;
  ready: boolean;
}

/**
 * The diagnostic that answers the open question: whether WebGPU engaged inside
 * the macOS webview, or we fell back to CPU/wasm. WebGPU on a nano pose model
 * lands around 8-20 ms; CPU/wasm around 80-300 ms.
 */
export function StatsHud({ stats, ready }: StatsHudProps) {
  const backendKnown = ready && stats.backend !== "—";

  return (
    <dl className="hud">
      <div className="hud__item">
        <dt>Backend</dt>
        <dd>
          <span
            className={`hud__badge hud__badge--${backendKnown ? stats.backend : "pending"}`}
          >
            {backendKnown ? stats.backend : "…"}
          </span>
        </dd>
      </div>
      <div className="hud__item">
        <dt>Inference</dt>
        <dd>{stats.inferenceMs > 0 ? `${stats.inferenceMs.toFixed(1)} ms` : "—"}</dd>
      </div>
      <div className="hud__item">
        <dt>Inference rate</dt>
        <dd>{stats.inferenceFps} fps</dd>
      </div>
      <div className="hud__item">
        <dt>Render</dt>
        <dd>{stats.renderFps} fps</dd>
      </div>
      <div className="hud__item">
        <dt>People</dt>
        <dd>{stats.people}</dd>
      </div>
    </dl>
  );
}
