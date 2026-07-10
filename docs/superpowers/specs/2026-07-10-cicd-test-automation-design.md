# CI/CD Test Automation & Build Optimization Design

**Date:** 2026-07-10
**Status:** Approved
**Author:** Claude

## Overview

Implement automated test execution on every commit/PR across all branches, with optimized build pipeline using parallel execution, better caching, and fail-fast behavior.

## Goals

1. Run tests on every push/PR (all branches)
2. Separate test job from build job (fail-fast)
3. Run both Rust unit tests and TypeScript/Vitest tests
4. Optimize build speed via:
   - WASM build as reusable artifact
   - Parallel OS builds
   - Better caching strategy
   - Cancel in-progress runs on new pushes

## Workflow Design

### 1. `tests.yml` - New Test Workflow

**Trigger:**
- `push` on all branches
- `pull_request` on all branches

**Fail-Fast Behavior:**
- If tests fail → workflow exits immediately
- Downstream build workflows check test status before running

**Jobs:**

#### `test-rust`
```yaml
runs-on: ubuntu-latest
steps:
  - checkout
  - uses: dtolnay/rust-toolchain@stable
  - name: Cache cargo
    uses: Swatinem/rust-cache@v2
    with:
      shared-key: rust-tests
  - run: cargo test --workspace --all-targets
```

#### `test-typescript`
```yaml
runs-on: ubuntu-latest
steps:
  - checkout
  - uses: actions/setup-node@v4
    with:
      node-version: '20'
      cache: 'pnpm'
      cache-dependency-path: pnpm-lock.yaml
  - run: pnpm install --frozen-lockfile
  - run: pnpm test
```

#### `test-scripts`
```yaml
runs-on: ubuntu-latest
steps:
  - checkout
  - uses: actions/setup-node@v4
    with:
      node-version: '20'
  - run: node --test scripts/*.test.mjs
```

**Concurrency:**
```yaml
concurrency:
  group: tests-${{ github.ref }}
  cancel-in-progress: true
```

### 2. `ci.yml` - Optimized Build Workflow

**Changes from current:**

1. **Concurrency Control:**
```yaml
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
```

2. **WASM as Reusable Artifact:**
- Build WASM once in a dedicated job
- Upload as artifact
- Download in each OS build job

3. **Better Cache Keys:**
```yaml
cache: cargo
cache-key: |
  cargo-target-${{ runner.os }}-${{ hashFiles('Cargo.lock') }}
  cargo-target-${{ runner.os }}-
```

4. **Parallel OS Builds:**
- No dependency between Windows/macOS/Linux builds
- All download pre-built WASM artifact

### 3. Build Speed Optimization Matrix

| Component | Before | After | Improvement |
|-----------|--------|-------|-------------|
| WASM Build | 3x (once per OS) | 1x (shared artifact) | ~60% faster |
| Old run cancellation | No | Yes | No wasted time |
| Cache hit rate | Medium | High (key by Cargo.lock) | ~40% faster |
| Parallel OS builds | Sequential | Parallel | ~3x faster total |

## Files to Modify

| File | Action |
|------|--------|
| `.github/workflows/tests.yml` | Create (new) |
| `.github/workflows/ci.yml` | Update (optimize) |

## Implementation Order

1. Create `tests.yml`
2. Add concurrency control to `ci.yml`
3. Add WASM artifact upload/download
4. Update cache keys
5. Test locally with `act` or push to feature branch

## Verification

After implementation:
- Push to feature branch → tests run first, build follows only if tests pass
- Check GitHub Actions timeline for parallel execution
- Verify cache hits on subsequent runs
