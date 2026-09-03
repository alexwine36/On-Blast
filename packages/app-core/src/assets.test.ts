import { describe, expect, it } from "bun:test";
import { resolveAssets } from "./assets";

describe("resolveAssets", () => {
	it("resolves against the root, as Tauri serves", () => {
		const a = resolveAssets("/");
		expect(a.wasmPath).toBe("/mediapipe/wasm");
		expect(a.handModel).toBe("/mediapipe/models/gesture_recognizer.task");
		expect(a.sting).toBe("/audio/sting.wav");
	});

	it("resolves against a project-site subpath", () => {
		// The failure this guards against 404s only in production: local dev and
		// Tauri both serve from "/", so an absolute path looks fine right up
		// until it is deployed under /On-Blast/.
		const a = resolveAssets("/On-Blast/");
		expect(a.wasmPath).toBe("/On-Blast/mediapipe/wasm");
		expect(a.bodyModel).toBe("/On-Blast/mediapipe/models/pose_landmarker_lite.task");
		expect(a.voice).toBe("/On-Blast/audio/voice-a4.wav");
	});

	it("tolerates a base without a trailing slash", () => {
		expect(resolveAssets("/On-Blast").wasmPath).toBe("/On-Blast/mediapipe/wasm");
	});

	it("never emits a doubled slash", () => {
		for (const base of ["/", "/On-Blast", "/On-Blast/", "/a/b/"]) {
			for (const url of Object.values(resolveAssets(base))) {
				expect(url.slice(1)).not.toContain("//");
			}
		}
	});
});
