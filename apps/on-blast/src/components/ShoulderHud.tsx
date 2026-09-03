import type { PostureMetrics } from "../body/posture";
import { DEFAULT_POSTURE as CFG } from "../body/posture";

interface ShoulderHudProps {
	posture: PostureMetrics;
	/** Note currently sounding, or null when silent. */
	note: string | null;
	keyName: string;
	toneSource: "sample" | "synth";
	tempoLabel: string;
}

const fmt = (n: number) => n.toFixed(2);

/**
 * Live readout for the shoulder synth. The gap range in particular is still a
 * guess — relax, then shrug, and read the two extremes off this panel.
 */
export function ShoulderHud({ posture, note, keyName, toneSource, tempoLabel }: ShoulderHudProps) {
	const rows = [
		{
			label: "Arm spread",
			values: [fmt(posture.armSpread[0]), fmt(posture.armSpread[1])],
			limit: `≥ ${CFG.spreadMin}`,
			pass: posture.armsOut,
		},
		{
			label: "Arm height",
			values: [fmt(posture.armHeight[0]), fmt(posture.armHeight[1])],
			limit: `≤ ${CFG.heightMax}`,
			pass: posture.armHeight.every((v) => v > 0 && v <= CFG.heightMax),
		},
		{
			label: "Ear→shoulder gap",
			values: [fmt(posture.shoulderGap), ""],
			limit: `${CFG.gapShrugged}–${CFG.gapRelaxed}`,
			pass: posture.visible,
		},
	];

	return (
		<section className="gesture">
			<header className="gesture__head">
				<span className="gesture__title">
					Shoulders · {keyName} · {toneSource === "sample" ? "vocal" : "synth"}
				</span>
				<span className={`gesture__state ${posture.armsOut ? "is-ok" : ""}`}>
					{note ? <span className="gesture__note">{note}</span> : posture.reason}
				</span>
			</header>

			<div className="gesture__meter" aria-hidden>
				<div
					className="gesture__meter-lift"
					style={{ width: `${posture.lift * 100}%`, opacity: posture.armsOut ? 1 : 0.35 }}
				/>
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
					<tr className={posture.armsOut ? "is-pass" : ""}>
						<td>Pitch</td>
						<td className="gesture__num">{fmt(posture.lift)}</td>
						<td className="gesture__num" />
						<td className="gesture__limit">0–1</td>
					</tr>
				</tbody>
			</table>
			<p className="gesture__hint">
				Gap shrinks as shoulders rise toward the ears. Relax then shrug, and read the two extremes
				here to set the range. Notes change on a {tempoLabel} grid.
			</p>
		</section>
	);
}
