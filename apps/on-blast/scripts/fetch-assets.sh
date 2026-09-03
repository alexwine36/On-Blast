#!/usr/bin/env bash
# Downloads the pose model and the ONNX Runtime Web build into public/.
# Both are git-ignored; this script is the source of truth for them.
set -euo pipefail

cd "$(dirname "$0")/.."

MODEL_RELEASE="https://github.com/ultralytics/assets/releases/download/v8.4.0"
MODEL="yolo26n-pose.onnx"
ORT_BASE="https://cdn.pyke.io/0/pyke:ort-rs/web@1.27.0"

# The ORT loader applies hardcoded SRI hashes, so these must be byte-exact
# mirrors. Both backends are vendored: we can't know which one engages, and the
# CPU build is also the WebGPU fallback path.
# NOTE: the `asyncify` pair is required by the WebGPU execution provider and is
# NOT listed in the package's `ortBaseUrl` doc comment (only the README's
# `{jsep,asyncify,}` brace expansion hints at it). Omitting it fails at model
# load with "no available backend found".
ORT_FILES=(
  "ort.webgpu.min.js"
  "ort-wasm-simd-threaded.jsep.wasm"
  "ort-wasm-simd-threaded.jsep.mjs"
  "ort-wasm-simd-threaded.asyncify.wasm"
  "ort-wasm-simd-threaded.asyncify.mjs"
  "ort.wasm.min.js"
  "ort-wasm-simd-threaded.wasm"
  "ort-wasm-simd-threaded.mjs"
)

mkdir -p public/models public/ort

echo "==> $MODEL"
curl -fsSL -o "public/models/$MODEL" "$MODEL_RELEASE/$MODEL"

for f in "${ORT_FILES[@]}"; do
  echo "==> $f"
  curl -fsSL -o "public/ort/$f" "$ORT_BASE/$f"
done

echo
echo "Done. Expected sizes:"
cat <<'SIZES'
  12125856  public/models/yolo26n-pose.onnx
     67237  public/ort/ort.webgpu.min.js
  26827543  public/ort/ort-wasm-simd-threaded.jsep.wasm
     46614  public/ort/ort-wasm-simd-threaded.jsep.mjs
  24254953  public/ort/ort-wasm-simd-threaded.asyncify.wasm
     47507  public/ort/ort-wasm-simd-threaded.asyncify.mjs
     50139  public/ort/ort.wasm.min.js
  13479978  public/ort/ort-wasm-simd-threaded.wasm
     24180  public/ort/ort-wasm-simd-threaded.mjs
SIZES