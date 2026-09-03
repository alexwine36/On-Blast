import { useState } from "react";
import { CameraPicker } from "./components/CameraPicker";
import { PoseView } from "./components/PoseView";
import { StatsHud } from "./components/StatsHud";
import { useCamera } from "./hooks/useCamera";
import { usePoseDetector } from "./hooks/usePoseDetector";
import { usePoseLoop } from "./hooks/usePoseLoop";
import "./App.css";

interface Notice {
  tone: "info" | "error";
  title: string;
  detail?: string;
}

function App() {
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
  const camera = useCamera(deviceId);
  const model = usePoseDetector();
  const { videoRef, canvasRef, stats } = usePoseLoop(model.detector, camera.stream);

  // Camera problems come first — without a picture, the model doesn't matter.
  let notice: Notice | null = null;
  if (camera.status === "error" && camera.error) {
    notice = { tone: "error", title: "Camera unavailable", detail: camera.error.message };
  } else if (camera.status === "starting") {
    notice = { tone: "info", title: "Waiting for the camera…" };
  } else if (model.status === "error") {
    notice = {
      tone: "error",
      title: "Could not load the pose model",
      detail: model.error ?? undefined,
    };
  } else if (model.status === "loading") {
    notice = {
      tone: "info",
      title: "Loading pose model…",
      detail: "First run initializes the ONNX Runtime wasm build.",
    };
  }

  return (
    <main className="app">
      <header className="app__bar">
        <h1 className="app__title">
          on&#8209;blast <span className="app__subtitle">pose</span>
        </h1>
        <CameraPicker
          devices={camera.devices}
          value={deviceId}
          onChange={setDeviceId}
          disabled={camera.status === "starting"}
        />
      </header>

      <PoseView
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
      />

      <StatsHud stats={stats} ready={model.status === "ready"} />
    </main>
  );
}

export default App;
