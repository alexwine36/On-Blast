/** Served from `public/`, so these are site-root paths, not bundled imports. */
const MODEL_PATH = "/models/yolo26n-pose.onnx";
const ORT_PATH = "/ort/";

/**
 * ONNX Runtime Web's loader resolves its files with `new URL(file, baseUrl)`,
 * which throws on a relative base — so `ortBaseUrl` has to be fully absolute.
 */
export const absoluteUrl = (path: string): string =>
  new URL(path, window.location.href).href;

export const MODEL_URL = MODEL_PATH;
export const ORT_BASE_URL = ORT_PATH;

/** Width we downscale each frame to before inference. */
export const CAPTURE_WIDTH = 640;

/** Detection confidence floor (matches the Ultralytics default). */
export const CONF = 0.25;

/** Per-keypoint confidence floor for drawing. */
export const KEYPOINT_THRESHOLD = 0.25;
