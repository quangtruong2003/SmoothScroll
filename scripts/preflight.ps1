# Pre-push verification for SmoothScroll. Runs everything we can verify on
# the current host before pushing to master (which auto-triggers a release
# build). Catches ~80% of issues that would otherwise fail CI.
#
# Cannot catch: macOS-specific code, GitHub Actions runner quirks. For those,
# push to a feature branch first — see docs/CONTRIBUTING-CI.md.

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Fail($msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red; exit 1 }

Step "cargo fmt --check"
cargo fmt --all -- --check
if ($LASTEXITCODE -ne 0) { Fail "cargo fmt has unformatted files; run 'cargo fmt --all'" }

Step "cargo clippy"
cargo clippy --workspace --all-targets -- -D warnings
if ($LASTEXITCODE -ne 0) { Fail "clippy has warnings" }

Step "cargo test --workspace"
cargo test --workspace
if ($LASTEXITCODE -ne 0) { Fail "cargo tests failing" }

Step "cargo build (host target, app crate)"
cargo build -p smoothscroll-app
if ($LASTEXITCODE -ne 0) { Fail "host build failed" }

Step "tsc --noEmit"
if (-not (Test-Path node_modules)) { Fail "node_modules missing; run 'npm ci' first" }
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) { Fail "TypeScript errors" }

Step "wasm engine build"
if (-not (Get-Command wasm-pack -ErrorAction SilentlyContinue)) {
  Fail "wasm-pack not installed; run 'cargo install wasm-pack'"
}
$installed = rustup target list --installed
if (-not ($installed -match "wasm32-unknown-unknown")) {
  Fail "wasm32 target missing; run 'rustup target add wasm32-unknown-unknown'"
}
npm run build:wasm
if ($LASTEXITCODE -ne 0) { Fail "wasm build failed" }

Step "All preflight checks passed"
Write-Host ""
Write-Host "Safe to push for non-risky paths."
Write-Host "For risky paths (crates/platform/src/macos, .github/workflows, Cargo.toml"
Write-Host "workspace, scripts/build-wasm.*) push to a feature branch first."
Write-Host "See docs/CONTRIBUTING-CI.md."
