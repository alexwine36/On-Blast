import type { OnBlastMetrics } from "@on-blast/vision";
import { DEFAULT_ON_BLAST as CFG } from "@on-blast/vision";

interface GestureHudProps {
	metrics: OnBlastMetrics;
	holdProgress: number;
	cooldown: number;
}

const fmt = (n: number) => n.toFixed(2);

/**
 * Live readout of the numbers behind the trigger, so thresholds can be tuned
 * against a real pair of hands instead of guessed at.
 */
export function GestureHud({ metrics, holdProgress, cooldown }: GestureHudProps) {
	const rows = [
		{
			label: "Hands seen",
			values: [metrics.handsSeen, ""] as [number | string, number | string],
			limit: "2",
			pass: metrics.handsSeen >= 2,
		},
		{
			label: "Open palms",
			values: [metrics.openPalms, ""] as [number | string, number | string],
			limit: "2",
			pass: metrics.openPalms >= 2,
		},
		{
			label: "Palm score",
			values: [fmt(metrics.palmScores[0]), fmt(metrics.palmScores[1])] as [string, string],
			limit: `≥ ${CFG.palmScoreMin}`,
			pass: metrics.palmScores[1] >= CFG.palmScoreMin,
		},
		{
			label: "Palm span (nearness)",
			values: [fmt(metrics.spans[0]), fmt(metrics.spans[1])] as [string, string],
			limit: `≥ ${CFG.spanMin}`,
			pass: metrics.spans[1] >= CFG.spanMin,
		},
		{
			label: "Approach rate",
			values: [fmt(metrics.approach), ""] as [string, string],
			limit: `≥ ${CFG.approachMin}`,
			pass: metrics.approach >= CFG.approachMin,
		},
	];

	return (
		<section className="gesture">
			<header className="gesture__head">
				<span className="gesture__title">On blast</span>
				<span className={`gesture__state ${metrics.ok ? "is-ok" : ""}`}>
					{cooldown > 0 ? "cooling down" : metrics.reason}
				</span>
			</header>

			<div className="gesture__meter" aria-hidden>
				{cooldown > 0 ? (
					<div className="gesture__meter-cooldown" style={{ width: `${cooldown * 100}%` }} />
				) : (
					<div className="gesture__meter-hold" style={{ width: `${holdProgress * 100}%` }} />
				)}
			</div>

			<table className="gesture__table">
				<tbody>
					{rows.map((row) => (
						<tr key={row.label} className={row.pass ? "is-pass" : ""}>
							<td>{row.label}</td>
							<td className="gesture__num">{row.values[0]}</td>
							<td className="gesture__num">{row.values[1]}</td>
							<td className="gesture__limit">{row.limit}</td>
						</tr>
					))}
				</tbody>
			</table>
			<p className="gesture__hint">
				Span is palm size in frame units — it grows as a hand nears the lens. Either a big enough
				span or a fast enough approach satisfies the gate.
			</p>
		</section>
	);
}
