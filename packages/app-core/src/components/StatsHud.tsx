import type { VisionStats } from "../hooks/useVisionLoop";

interface StatsHudProps {
	stats: VisionStats;
	ready: boolean;
	stingSource: "sample" | "synth";
	/** False once the phrase has played; only an ON BLAST re-arms it. */
	phraseArmed: boolean;
}

export function StatsHud({ stats, ready, stingSource, phraseArmed }: StatsHudProps) {
	const backendKnown = ready && stats.backend !== "—";

	return (
		<dl className="hud">
			<div className="hud__item">
				<dt>Backend</dt>
				<dd>
					<span className={`hud__badge hud__badge--${backendKnown ? stats.backend : "pending"}`}>
						{backendKnown ? stats.backend : "…"}
					</span>
				</dd>
			</div>
			<div className="hud__item">
				<dt>Hands / body</dt>
				<dd>
					{stats.inferenceMs > 0 ? `${stats.inferenceMs.toFixed(0)}` : "—"}
					{" / "}
					{stats.bodyMs > 0 ? `${stats.bodyMs.toFixed(0)} ms` : "— ms"}
				</dd>
			</div>
			<div className="hud__item">
				<dt>Detect rate</dt>
				<dd>{stats.detectFps} fps</dd>
			</div>
			<div className="hud__item">
				<dt>Render</dt>
				<dd>{stats.renderFps} fps</dd>
			</div>
			<div className="hud__item">
				<dt>Hands</dt>
				<dd>{stats.metrics.handsSeen}</dd>
			</div>
			<div className="hud__item">
				<dt>Phrase</dt>
				<dd>
					<span className={`hud__badge hud__badge--${phraseArmed ? "webgpu" : "cpu"}`}>
						{phraseArmed ? "armed" : "spent"}
					</span>
				</dd>
			</div>
			<div className="hud__item">
				<dt>Sting</dt>
				<dd>
					<span className={`hud__badge hud__badge--${stingSource === "sample" ? "webgpu" : "cpu"}`}>
						{stingSource}
					</span>
				</dd>
			</div>
		</dl>
	);
}
