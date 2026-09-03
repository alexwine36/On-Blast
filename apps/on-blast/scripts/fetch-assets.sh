#!/usr/bin/env bash
# Stages the MediaPipe wasm runtime and models into public/.
# Both are git-ignored; this script is the source of truth for them.
set -euo pipefail

cd "$(dirname "$0")/.."

MODEL_BASE="https://storage.googleapis.com/mediapipe-models"

mkdir -p public/mediapipe/wasm public/mediapipe/models

# The wasm runtime ships inside the npm package — copy rather than download so
# it can never drift from the JS that loads it.
echo "==> mediapipe wasm runtime (from node_modules)"
if [ ! -d node_modules/@mediapipe/tasks-vision/wasm ]; then
  echo "    node_modules missing; run 'bun install' first" >&2
  exit 1
fi
cp node_modules/@mediapipe/tasks-vision/wasm/* public/mediapipe/wasm/

echo "==> gesture_recognizer.task"
curl -fsSL -o public/mediapipe/models/gesture_recognizer.task \
  "$MODEL_BASE/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task"

echo
echo "Done. Expected sizes:"
echo "   8373440  public/mediapipe/models/gesture_recognizer.task"
echo "     ~34M   public/mediapipe/wasm/"
