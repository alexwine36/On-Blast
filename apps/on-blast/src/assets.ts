/**
 * Runtime asset URLs, resolved against the app's base path.
 *
 * Tauri serves from "/" but a GitHub project site serves from "/<repo>/", so
 * absolute paths would 404 in production while looking perfectly fine in local
 * dev. Vite sets `import.meta.env.BASE_URL` per app, which is the one value
 * that is correct in both.
 */
export interface AssetUrls {
	wasmPath: string;
	handModel: string;
	bodyModel: string;
	sting: string;
	voice: string;
}

export function resolveAssets(base: string = import.meta.env.BASE_URL): AssetUrls {
	const b = base.endsWith("/") ? base : `${base}/`;
	return {
		wasmPath: `${b}mediapipe/wasm`,
		handModel: `${b}mediapipe/models/gesture_recognizer.task`,
		bodyModel: `${b}mediapipe/models/pose_landmarker_lite.task`,
		sting: `${b}audio/sting.wav`,
		voice: `${b}audio/voice-a4.wav`,
	};
}
