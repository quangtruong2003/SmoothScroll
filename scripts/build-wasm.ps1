# Build the WASM engine and copy output into src/lib/engine-wasm
$ErrorActionPreference = "Stop"
$out = "src/lib/engine-wasm"
if (Test-Path $out) { Remove-Item -Recurse -Force $out }
wasm-pack build crates/core --target web --out-dir ../../$out --features wasm
