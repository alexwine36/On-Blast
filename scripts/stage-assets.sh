#!/usr/bin/env bash
# Stages runtime assets into an app's public/ directory.
#
# Assets are not committed: the MediaPipe wasm already ships inside
# node_modules, the models are large, and the sting is licensed audio that
# must not reach a public repo. This script is the source of truth, and CI
# runs it before building.
#
#   usage: scripts/stage-assets.sh <app-name>       e.g. on-blast | web
set -euo pipefail

APP="${1:?usage: stage-assets.sh <app-name>}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/apps/$APP/public"
[ -d "$ROOT/apps/$APP" ] || { echo "no such app: $APP" >&2; exit 1; }

MODEL_BASE="https://storage.googleapis.com/mediapipe-models"
# Bun may hoist to the root or keep the dep beside the package that declares
# it, so check both rather than assuming a layout.
WASM_SRC=""
for candidate in \
  "$ROOT/node_modules/@mediapipe/tasks-vision/wasm" \
  "$ROOT/packages/vision/node_modules/@mediapipe/tasks-vision/wasm"; do
  [ -d "$candidate" ] && WASM_SRC="$candidate" && break
done

mkdir -p "$DEST/mediapipe/wasm" "$DEST/mediapipe/models" "$DEST/audio"

# Copy rather than download the wasm, so it can never drift from the JS that
# loads it.
[ -n "$WASM_SRC" ] || { echo "mediapipe wasm not found; run 'bun install' first" >&2; exit 1; }
echo "==> mediapipe wasm runtime"
cp "$WASM_SRC"/* "$DEST/mediapipe/wasm/"

echo "==> gesture_recognizer.task"
curl -fsSL -o "$DEST/mediapipe/models/gesture_recognizer.task" \
  "$MODEL_BASE/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task"

# The body model is only needed when the shoulder synth is enabled; it is off,
# so skip 5.8 MB of download.
if [ "${WITH_BODY_MODEL:-0}" = "1" ]; then
  echo "==> pose_landmarker_lite.task"
  curl -fsSL -o "$DEST/mediapipe/models/pose_landmarker_lite.task" \
    "$MODEL_BASE/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
fi

# Audio. The sting is licensed and git-ignored, so it is present locally and
# absent in CI — the engine falls back to its synthesized sting either way.
echo "==> audio"
for f in "$ROOT"/packages/app-core/assets/audio/*.wav; do
  [ -e "$f" ] || continue
  cp "$f" "$DEST/audio/"
done

echo
echo "staged into apps/$APP/public:"
du -sh "$DEST"/* 2>/dev/null | sed 's/^/  /'
