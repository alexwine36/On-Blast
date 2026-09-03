import { useEffect, useRef, useState } from "react";
import { createWebAudioEngine } from "../audio/webAudioEngine";
import type { AudioEngine, AudioStatus } from "../audio/types";

export function useAudioEngine() {
  const engineRef = useRef<AudioEngine | null>(null);
  const [status, setStatus] = useState<AudioStatus>("idle");
  const [source, setSource] = useState<"sample" | "synth">("synth");

  useEffect(() => {
    const engine = createWebAudioEngine();
    engineRef.current = engine;
    setStatus(engine.status);

    // Autoplay policy keeps the context suspended until a real interaction.
    const unlock = () => {
      void engine.unlock().then(() => setStatus(engine.status));
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    unlock();

    const poll = setInterval(() => {
      setStatus(engine.status);
      setSource(engine.source);
    }, 500);

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      clearInterval(poll);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  return {
    status,
    source,
    playSting: () => engineRef.current?.playSting(),
    setDrone: (active: boolean, pitch: number) => engineRef.current?.setDrone(active, pitch),
    unlock: () => engineRef.current?.unlock().then(() => setStatus(engineRef.current!.status)),
  };
}
