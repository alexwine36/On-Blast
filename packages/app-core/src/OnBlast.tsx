import { ON_BLAST_PHRASE } from "@on-blast/audio";
import type { PostureMetrics } from "@on-blast/vision";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AssetUrls } from "./assets";
import { resolveAssets } from "./assets";
import { CameraPicker } from "./components/CameraPicker";
import { CameraView } from "./components/CameraView";
import { GestureHud } from "./components/GestureHud";
import { HitOverlay } from "./components/HitOverlay";
import { ShoulderHud } from "./components/ShoulderHud";
import { StatsHud } from "./components/StatsHud";
import type { Features } from "./features";
import { DEFAULT_FEATURES } from "./features";
import { useAudioEngine } from "./hooks/useAudioEngine";
import { useBodyDetector } from "./hooks/useBodyDetector";
import { useCamera } from "./hooks/useCamera";
import { useHandDetector } from "./hooks/useHandDetector";
import { useVisionLoop } from "./hooks/useVisionLoop";
import "./OnBlast.css";

interface Notice {
	tone: "info" | "error";
	title: string;
	detail?: string;
}

/** How long the punch-in stays up. Matches the CSS animation duration. */
const HIT_VISIBLE_MS = 1500;

export interface OnBlastProps {
	/**
	 * Base URL for runtime assets. Defaults to the app's own base path, which
	 * Vite sets per app — "/" under Tauri, "/On-Blast/" on a project site.
	 */
	assetBase?: string;
	/** Per-app feature overrides. */
	features?: Partial<Features>;
}

export function OnBlast({ assetBase, features }: OnBlastProps = {}) {
	const flags = useMemo(() => ({ ...DEFAULT_FEATURES, ...features }), [features]);
	const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
	// Increments on every hit; used as the overlay's key so its animation replays.
	const [hitId, setHitId] = useState(0);
	const [hitVisible, setHitVisible] = useState(false);

	// Resolved once from the app's base path; see src/assets.ts.
	const assets: AssetUrls = useMemo(() => resolveAssets(assetBase), [assetBase]);

	const camera = useCamera(deviceId);
	const model = useHandDetector({ wasmPath: assets.wasmPath, modelPath: assets.handModel });
	const body = useBodyDetector(
		{ wasmPath: assets.wasmPath, modelPath: assets.bodyModel },
		flags.armPhrase,
	);
	const audio = useAudioEngine({ stingUrl: assets.sting, voiceUrl: assets.voice });

	/**
	 * The phrase fires once per ON BLAST.
	 *
	 * Arms out plays it, then latches spent; only a hit re-arms. Without the
	 * latch, standing with your arms out replays it endlessly.
	 */
	const phraseArmed = useRef(true);
	const [armed, setArmed] = useState(true);

	const handleTrigger = useCallback(() => {
		audio.playSting();
		phraseArmed.current = true;
		setArmed(true);
		setHitId((n) => n + 1);
		setHitVisible(true);
	}, [audio]);

	const handleArmsOut = useCallback(() => {
		if (!flags.armPhrase || !phraseArmed.current) return;
		phraseArmed.current = false;
		setArmed(false);
		audio.playPhrase(ON_BLAST_PHRASE);
	}, [audio, flags.armPhrase]);

	// Auto-hide. hitId is depended on deliberately: it is not read in the body,
	// but a new hit must restart the timer rather than inherit the old one's
	// remaining time.
	// biome-ignore lint/correctness/useExhaustiveDependencies: intentional restart key
	useEffect(() => {
		if (!hitVisible) return;
		const id = setTimeout(() => setHitVisible(false), HIT_VISIBLE_MS);
		return () => clearTimeout(id);
	}, [hitId, hitVisible]);

	// Shoulder height drives the drone pitch; arms-out is the gate that sounds it.
	// Posture is now only read for the HUD; the phrase replaces the
	// shoulder-height synth that followed it continuously.
	const handlePosture = useCallback((_posture: PostureMetrics) => {}, []);

	const { videoRef, canvasRef, stats, reset } = useVisionLoop({
		detector: model.detector,
		bodyDetector: body.detector,
		stream: camera.stream,
		active: true,
		onTrigger: handleTrigger,
		onArmsOut: handleArmsOut,
		onPosture: handlePosture,
	});

	// Camera problems come first — without a picture, the model doesn't matter.
	let notice: Notice | null = null;
	if (camera.status === "error" && camera.error) {
		notice = { tone: "error", title: "Camera unavailable", detail: camera.error.message };
	} else if (camera.status === "starting") {
		notice = { tone: "info", title: "Waiting for the camera…" };
	} else if (model.status === "error") {
		notice = {
			tone: "error",
			title: "Could not load the hand model",
			detail: model.error ?? undefined,
		};
	} else if (model.status === "loading") {
		notice = {
			tone: "info",
			title: "Loading hand model…",
			detail: "First run initializes the MediaPipe wasm runtime.",
		};
	}

	return (
		<main className="app">
			<header className="app__bar">
				<h1 className="app__title">
					on&#8209;blast <span className="app__subtitle">pose</span>
				</h1>
				<div className="app__actions">
					{audio.status === "blocked" ? (
						<button type="button" className="btn btn--warn" onClick={() => void audio.unlock()}>
							Enable sound
						</button>
					) : null}
					<button type="button" className="btn" onClick={reset}>
						Reset
					</button>
					<CameraPicker
						devices={camera.devices}
						value={deviceId}
						onChange={setDeviceId}
						disabled={camera.status === "starting"}
					/>
				</div>
			</header>

			<CameraView
				videoRef={videoRef}
				canvasRef={canvasRef}
				notice={
					notice ? (
						<div className={`notice notice--${notice.tone}`}>
							<strong className="notice__title">{notice.title}</strong>
							{notice.detail ? <p className="notice__detail">{notice.detail}</p> : null}
						</div>
					) : null
				}
				overlay={hitVisible ? <HitOverlay key={hitId} /> : null}
			/>

			<div className="app__panels">
				<GestureHud
					metrics={stats.metrics}
					holdProgress={stats.holdProgress}
					cooldown={stats.cooldown}
				/>
				{flags.armPhrase ? (
					<ShoulderHud
						posture={stats.posture}
						note={audio.note}
						keyName={audio.keyName}
						toneSource={audio.toneSource}
						tempoLabel={audio.tempoLabel}
					/>
				) : null}
				<StatsHud
					phraseArmed={armed}
					stats={stats}
					ready={model.status === "ready"}
					stingSource={audio.source}
				/>
			</div>
		</main>
	);
}
