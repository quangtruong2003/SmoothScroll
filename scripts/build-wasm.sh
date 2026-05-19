#!/usr/bin/env bash
set -euo pipefail
out="src/lib/engine-wasm"
rm -rf "$out"
wasm-pack build crates/core --target web --out-dir ../../"$out" --features wasm
