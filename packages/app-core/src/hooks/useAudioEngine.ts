import type { AudioEngine, AudioEngineOptions, AudioStatus, Phrase } from "@on-blast/audio";
import { createWebAudioEngine } from "@on-blast/audio";
import { useEffect, useRef, useState } from "react";

export function useAudioEngine(options: AudioEngineOptions) {
	const engineRef = useRef<AudioEngine | null>(null);
	const [status, setStatus] = useState<AudioStatus>("idle");
	const [source, setSource] = useState<"sample" | "synth">("synth");
	const [toneSource, setToneSource] = useState<"sample" | "synth">("synth");
	const [note, setNote] = useState<string | null>(null);

	// The engine is built once for the lifetime of the app.
	// biome-ignore lint/correctness/useExhaustiveDependencies: load-once
	useEffect(() => {
		const engine = createWebAudioEngine(options);
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
			setToneSource(engine.toneSource);
		}, 500);
		// The note changes far faster than the status poll, so sample it tighter.
		const notePoll = setInterval(() => setNote(engine.currentNote), 80);

		return () => {
			window.removeEventListener("pointerdown", unlock);
			window.removeEventListener("keydown", unlock);
			clearInterval(poll);
			clearInterval(notePoll);
			engine.dispose();
			engineRef.current = null;
		};
	}, []);

	return {
		status,
		source,
		note,
		toneSource,
		keyName: engineRef.current?.keyName ?? "",
		tempoLabel: engineRef.current?.tempoLabel ?? "",
		playSting: () => engineRef.current?.playSting(),
		playPhrase: (phrase: Phrase) => engineRef.current?.playPhrase(phrase),
		setTone: (active: boolean, pitch: number) => engineRef.current?.setTone(active, pitch),
		unlock: async () => {
			const engine = engineRef.current;
			if (!engine) return;
			await engine.unlock();
			setStatus(engine.status);
		},
	};
}
