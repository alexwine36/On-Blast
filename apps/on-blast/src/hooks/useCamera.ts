import { useEffect, useState } from "react";

export type CameraStatus = "starting" | "ready" | "error";

export type CameraErrorKind = "denied" | "notfound" | "unsupported" | "unknown";

export interface CameraError {
	kind: CameraErrorKind;
	message: string;
}

function stopStream(stream: MediaStream): void {
	for (const track of stream.getTracks()) track.stop();
}

function classify(err: unknown): CameraError {
	const name = err instanceof Error ? err.name : "";
	if (name === "NotAllowedError" || name === "SecurityError") {
		return {
			kind: "denied",
			message:
				"Camera access was denied. In dev, macOS attributes the request to the terminal that " +
				"launched the app — grant it camera access under Privacy & Security.",
		};
	}
	if (name === "NotFoundError" || name === "OverconstrainedError" || name === "NotReadableError") {
		return {
			kind: "notfound",
			message: "No usable camera was found, or it is in use by another app.",
		};
	}
	return { kind: "unknown", message: err instanceof Error ? err.message : String(err) };
}

/**
 * Opens a camera and keeps it open until unmount or a device change.
 *
 * Written to survive React StrictMode's double-mount: a leaked `MediaStream`
 * keeps the camera light on and can block reacquisition, so every path that
 * could orphan a stream stops it explicitly.
 */
export function useCamera(deviceId?: string) {
	const [stream, setStream] = useState<MediaStream | null>(null);
	const [status, setStatus] = useState<CameraStatus>("starting");
	const [error, setError] = useState<CameraError | null>(null);
	const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

	useEffect(() => {
		let cancelled = false;
		let opened: MediaStream | null = null;

		void (async () => {
			setStatus("starting");
			setError(null);

			// Undefined outside a secure context — which is the symptom to look for
			// if the bundled app's `tauri://localhost` origin is not trusted.
			if (!navigator.mediaDevices?.getUserMedia) {
				setStatus("error");
				setError({
					kind: "unsupported",
					message:
						"navigator.mediaDevices is unavailable, which means this page is not a secure context.",
				});
				return;
			}

			try {
				opened = await navigator.mediaDevices.getUserMedia({
					audio: false,
					video: deviceId
						? { deviceId: { exact: deviceId } }
						: { width: { ideal: 1280 }, height: { ideal: 720 } },
				});

				// Cleanup may have run while getUserMedia was in flight.
				if (cancelled) {
					stopStream(opened);
					return;
				}

				setStream(opened);
				setStatus("ready");

				// Device labels are only populated once permission has been granted,
				// so enumerate after opening rather than before.
				const all = await navigator.mediaDevices.enumerateDevices();
				if (!cancelled) setDevices(all.filter((d) => d.kind === "videoinput"));
			} catch (err) {
				if (cancelled) return;
				setStatus("error");
				setError(classify(err));
			}
		})();

		return () => {
			cancelled = true;
			if (opened) stopStream(opened);
			setStream(null);
		};
	}, [deviceId]);

	return { stream, status, error, devices };
}
