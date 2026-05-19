# Build the WASM engine and copy output into src/lib/engine-wasm
# wasm-opt is disabled via Cargo.toml metadata. Rust release optimization
# still applies.
$ErrorActionPreference = "Stop"
$out = "src/lib/engine-wasm"
if (Test-Path $out) { Remove-Item -Recurse -Force $out }
wasm-pack build --release crates/core --target web --out-dir ../../$out --features wasm
