import { YOLO, type Results } from "@ultralytics/yolo";
import { CONF, MODEL_URL, ORT_BASE_URL, absoluteUrl } from "./config";
import type { PoseDetector, PoseFrame, PoseSource } from "./types";

/**
 * The only module that touches `@ultralytics/yolo` (AGPL-3.0). Everything else
 * talks to the `PoseDetector` interface.
 */
export async function createUltralyticsDetector(): Promise<PoseDetector> {
  const model = await YOLO.load(MODEL_URL, {
    device: "auto",
    // Points at our vendored copy in `public/ort/` so nothing is fetched from
    // cdn.pyke.io at runtime. Must be absolute — see `absoluteUrl`.
    ortBaseUrl: absoluteUrl(ORT_BASE_URL),
  });

  if (model.task !== "pose") {
    model.free();
    throw new Error(`Expected a pose model but "${MODEL_URL}" reports task "${model.task}".`);
  }

  return {
    // A getter, not a snapshot: `device` reflects the backend that actually
    // engaged, including a WebGPU-to-CPU fallback.
    get backend() {
      return model.device;
    },
    async predict(source: PoseSource): Promise<PoseFrame> {
      return toPoseFrame(await model.predict(source, { conf: CONF }));
    },
    free() {
      model.free();
    },
  };
}

function toPoseFrame(results: Results): PoseFrame {
  return {
    width: results.width,
    height: results.height,
    // For pose, `keypoints` and `boxes` are parallel arrays.
    people: results.keypoints.map((kp, i) => ({
      keypoints: kp.points,
      score: results.boxes[i]?.conf ?? 0,
    })),
    inferenceMs: results.speed.inference,
  };
}
