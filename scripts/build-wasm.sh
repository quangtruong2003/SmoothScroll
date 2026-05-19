#!/usr/bin/env bash
set -euo pipefail
out="src/lib/engine-wasm"
rm -rf "$out"
# wasm-opt is disabled via Cargo.toml metadata to avoid CI breakage from
# bulk-memory validation issues. Rust release optimization still applies.
wasm-pack build --release crates/core --target web --out-dir ../../"$out" --features wasm
