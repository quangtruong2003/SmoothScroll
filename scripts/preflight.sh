#!/usr/bin/env bash
# Pre-push verification for SmoothScroll. Runs everything we can verify on
# the current host before pushing to master (which auto-triggers a release
# build). Catches ~80% of issues that would otherwise fail CI.
#
# Cannot catch: macOS-specific code, GitHub Actions runner quirks. For those,
# push to a feature branch first — see docs/CONTRIBUTING-CI.md.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

step() { printf "\n\033[36m==> %s\033[0m\n" "$*"; }
fail() { printf "\033[31m[FAIL] %s\033[0m\n" "$*" >&2; exit 1; }

step "cargo fmt --check"
cargo fmt --all -- --check || fail "cargo fmt has unformatted files; run 'cargo fmt --all'"

step "cargo clippy"
cargo clippy --workspace --all-targets -- -D warnings || fail "clippy has warnings"

step "cargo test --workspace"
cargo test --workspace || fail "cargo tests failing"

step "cargo build (host target, app crate)"
cargo build -p smoothscroll-app || fail "host build failed"

step "tsc --noEmit"
if [ ! -d node_modules ]; then
  fail "node_modules missing; run 'npm ci' first"
fi
npx tsc --noEmit || fail "TypeScript errors"

step "wasm engine build"
if ! command -v wasm-pack >/dev/null 2>&1; then
  fail "wasm-pack not installed; run 'cargo install wasm-pack'"
fi
if ! rustup target list --installed | grep -q wasm32-unknown-unknown; then
  fail "wasm32 target missing; run 'rustup target add wasm32-unknown-unknown'"
fi
npm run build:wasm || fail "wasm build failed"

step "All preflight checks passed"
echo
echo "Safe to push for non-risky paths."
echo "For risky paths (crates/platform/src/macos, .github/workflows, Cargo.toml"
echo "workspace, scripts/build-wasm.*) push to a feature branch first."
echo "See docs/CONTRIBUTING-CI.md."
