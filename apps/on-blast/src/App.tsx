import { useCallback, useEffect, useState } from "react";
import { CameraPicker } from "./components/CameraPicker";
import { GestureHud } from "./components/GestureHud";
import { HitOverlay } from "./components/HitOverlay";
import { ShoulderHud } from "./components/ShoulderHud";
import type { PostureMetrics } from "./body/posture";
import { CameraView } from "./components/CameraView";
import { StatsHud } from "./components/StatsHud";
import { useAudioEngine } from "./hooks/useAudioEngine";
import { useCamera } from "./hooks/useCamera";
import { useBodyDetector } from "./hooks/useBodyDetector";
import { useHandDetector } from "./hooks/useHandDetector";
import { useVisionLoop } from "./hooks/useVisionLoop";
import "./App.css";

interface Notice {
  tone: "info" | "error";
  title: string;
  detail?: string;
}

/** How long the punch-in stays up. Matches the CSS animation duration. */
const HIT_VISIBLE_MS = 1500;

function App() {
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
  // Increments on every hit; used as the overlay's key so its animation replays.
  const [hitId, setHitId] = useState(0);
  const [hitVisible, setHitVisible] = useState(false);

  const camera = useCamera(deviceId);
  const model = useHandDetector();
  const body = useBodyDetector();
  const audio = useAudioEngine();

  const handleTrigger = useCallback(() => {
    audio.playSting();
    setHitId((n) => n + 1);
    setHitVisible(true);
  }, [audio]);

  // Auto-hide. Keyed on hitId so a hit landing while one is showing restarts
  // the timer rather than being cut short by the previous one.
  useEffect(() => {
    if (!hitVisible) return;
    const id = setTimeout(() => setHitVisible(false), HIT_VISIBLE_MS);
    return () => clearTimeout(id);
  }, [hitId, hitVisible]);

  // Shoulder height drives the drone pitch; arms-out is the gate that sounds it.
  const handlePosture = useCallback(
    (posture: PostureMetrics) => {
      audio.setDrone(posture.armsOut, posture.lift);
    },
    [audio],
  );

  const { videoRef, canvasRef, stats, reset } = useVisionLoop({
    detector: model.detector,
    bodyDetector: body.detector,
    stream: camera.stream,
    active: true,
    onTrigger: handleTrigger,
    onPosture: handlePosture,
  });

  // Camera problems come first — without a picture, the model doesn't matter.
  let notice: Notice | null = null;
  if (camera.status === "error" && camera.error) {
    notice = { tone: "error", title: "Camera unavailable", detail: camera.error.message };
  } else if (camera.status === "starting") {
    notice = { tone: "info", title: "Waiting for the camera…" };
  } else if (model.status === "error") {
    notice = { tone: "error", title: "Could not load the hand model", detail: model.error ?? undefined };
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
            <button className="btn btn--warn" onClick={() => void audio.unlock()}>
              Enable sound
            </button>
          ) : null}
          <button className="btn" onClick={reset}>
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
        <ShoulderHud posture={stats.posture} />
        <StatsHud stats={stats} ready={model.status === "ready"} stingSource={audio.source} />
      </div>
    </main>
  );
}

export default App;
