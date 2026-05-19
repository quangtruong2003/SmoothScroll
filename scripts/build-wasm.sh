#!/usr/bin/env bash
set -euo pipefail
out="src/lib/engine-wasm"
rm -rf "$out"
# --dev skips wasm-opt; the engine is small (~30KB) and not on a hot path
# requiring extra optimization. Switch to release later if profiling shows
# the preview is too slow.
wasm-pack build --dev crates/core --target web --out-dir ../../"$out" --features wasm
