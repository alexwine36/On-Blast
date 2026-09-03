import type { PointingMetrics } from "@on-blast/vision";
import { DEFAULT_POINTING as CFG } from "@on-blast/vision";

interface PointHudProps {
	pointing: PointingMetrics;
	/** False once the phrase has played; only an ON BLAST re-arms it. */
	armed: boolean;
}

export function PointHud({ pointing, armed }: PointHudProps) {
	return (
		<section className="gesture">
			<header className="gesture__head">
				<span className="gesture__title">Point · {CFG.hand} hand</span>
				<span className={`gesture__state ${pointing.ok ? "is-ok" : ""}`}>
					{armed ? pointing.reason : "spent — hit ON BLAST to re-arm"}
				</span>
			</header>

			<table className="gesture__table">
				<tbody>
					<tr className={pointing.pointing ? "is-pass" : ""}>
						<td>Index finger up</td>
						<td className="gesture__num">{pointing.pointing ? "yes" : "no"}</td>
						<td className="gesture__num" />
						<td className="gesture__limit">Pointing_Up</td>
					</tr>
					<tr className={pointing.score >= CFG.scoreMin ? "is-pass" : ""}>
						<td>Confidence</td>
						<td className="gesture__num">{pointing.score.toFixed(2)}</td>
						<td className="gesture__num" />
						<td className="gesture__limit">≥ {CFG.scoreMin}</td>
					</tr>
					<tr className={pointing.hand === CFG.hand ? "is-pass" : ""}>
						<td>Which hand</td>
						<td className="gesture__num">{pointing.hand}</td>
						<td className="gesture__num">{pointing.rawHandedness || "—"}</td>
						<td className="gesture__limit">{CFG.hand}</td>
					</tr>
				</tbody>
			</table>
			<p className="gesture__hint">
				Second column is MediaPipe's raw label. It assumes a mirrored image and ours is not, so it
				is inverted on purpose — if "which hand" reads backwards, flip <code>inputMirrored</code>.
			</p>
		</section>
	);
}
