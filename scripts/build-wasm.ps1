# Build the WASM engine and copy output into src/lib/engine-wasm
# --dev skips wasm-opt; the engine is small (~30KB) and not on a hot path
# requiring extra optimization.
$ErrorActionPreference = "Stop"
$out = "src/lib/engine-wasm"
if (Test-Path $out) { Remove-Item -Recurse -Force $out }
wasm-pack build --dev crates/core --target web --out-dir ../../$out --features wasm
