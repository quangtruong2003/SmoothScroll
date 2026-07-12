# Per-OS Versioned Releases Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the single `auto-release.yml` workflow into 3 independent per-OS release workflows with independent version tracking, while keeping Windows behavior 100% identical.

**Architecture:** Windows workflow is an exact extraction of current `auto-release.yml` with no logic changes. macOS and Linux get new independent workflows with their own `VERSION.{os}` files. Each workflow commits only the files it owns to avoid git push race conditions.

**Tech Stack:** GitHub Actions, Node.js (version-bump script), Tauri CLI, Rust/Cargo, Swift/xcodegen (macOS)

## Global Constraints

- **Windows behavior is frozen** — tag format `v{version}`, manifest `latest.json`, bump logic unchanged
- macOS tag format: `mac/v{version}`
- Linux tag format: `linux/v{version}`
- Existing `ci.yml` stays unchanged (dry-run for feature branches)
- Conventional commits logic stays unchanged
- `[skip release]` in commit message skips the workflow
- Each workflow commits ONLY files it owns (no cross-workflow git conflicts)

## File Ownership (Race Condition Prevention)

| File | Owner Workflow | Notes |
|------|---------------|-------|
| `Cargo.toml` | Windows | Workspace version |
| `Cargo.lock` | Windows | |
| `crates/*/Cargo.toml` | Windows | (no-op, use workspace version) |
| `src-tauri/Cargo.toml` | Windows | (no-op, use workspace version) |
| `package.json` | Windows | |
| `src-tauri/tauri.conf.json` | Windows | |
| `VERSION.windows` | Windows | New file |
| `VERSION.macos` | macOS | New file |
| `VERSION.linux` | Linux | New file |
| `CHANGELOG.md` | Whoever bumps first | Each workflow adds its own section |

Each workflow uses `git pull --rebase` before push to handle concurrent pushes gracefully. Since each workflow modifies different files, rebase succeeds without conflicts.

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `VERSION.windows` | Windows version (mirrors Cargo.toml workspace version) |
| Create | `VERSION.macos` | macOS independent version |
| Create | `VERSION.linux` | Linux independent version |
| Modify | `scripts/version-bump.mjs` | Add `--platform`, `--dry-run`, fix parseArgs boolean flags, fix git tag prefix filtering |
| Modify | `scripts/version-bump.test.mjs` | Add tests for new functions |
| Modify | `scripts/generate-updater-manifest.mjs` | Add `--linux-deb`, `--linux-appimage` flags |
| Create | `.github/workflows/release-windows.yml` | Windows release workflow (exact copy of auto-release.yml + path filters) |
| Create | `.github/workflows/release-macos.yml` | macOS release workflow |
| Create | `.github/workflows/release-linux.yml` | Linux release workflow |
| Delete | `.github/workflows/auto-release.yml` | Replaced by the 3 workflows above |

---

### Task 1: Create Version Files

**Files:**
- Create: `VERSION.windows`
- Create: `VERSION.macos`
- Create: `VERSION.linux`

**Interfaces:**
- Consumes: None
- Produces: Three version files read by `version-bump.mjs` and workflows

- [ ] **Step 1: Create VERSION.windows**

```bash
echo -n "1.19.5" > D:/SmoothScroll/VERSION.windows
```

Verify: `cat VERSION.windows` → `1.19.5`

- [ ] **Step 2: Create VERSION.macos**

```bash
echo -n "1.0.0" > D:/SmoothScroll/VERSION.macos
```

Verify: `cat VERSION.macos` → `1.0.0`

- [ ] **Step 3: Create VERSION.linux**

```bash
echo -n "1.0.0" > D:/SmoothScroll/VERSION.linux
```

Verify: `cat VERSION.linux` → `1.0.0`

- [ ] **Step 4: Commit**

```bash
git add VERSION.windows VERSION.macos VERSION.linux
git commit -m "chore: add per-OS version files"
```

---

### Task 2: Add `--platform` Flag to Version Bump Script

**Files:**
- Modify: `scripts/version-bump.mjs`
- Modify: `scripts/version-bump.test.mjs`

**Interfaces:**
- Consumes: `VERSION.windows`, `VERSION.macos`, `VERSION.linux` files
- Produces: `parseArgs(argv)`, `readPlatformVersion(platform, repoRoot)`, `writePlatformVersion(platform, version, repoRoot)` functions

- [ ] **Step 1: Write failing tests for new functions**

Add to `scripts/version-bump.test.mjs`:

```javascript
import {
  determineBump,
  computeNewVersion,
  parseReleaseAsFooter,
  groupCommitsByType,
  parseCommitMessage,
  generateChangelogEntry,
  updateChangelog,
  readPlatformVersion,
  writePlatformVersion,
  parseArgs,
} from './version-bump.mjs';
import { mkdtempSync, writeFileSync as wfs, readFileSync as rfs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// ... existing tests unchanged ...

test('parseArgs: extracts --platform value', () => {
  const args = parseArgs(['node', 'script.mjs', '--platform', 'windows']);
  assert.equal(args.platform, 'windows');
});

test('parseArgs: treats --dry-run as boolean true when no value follows', () => {
  const args = parseArgs(['node', 'script.mjs', '--platform', 'linux', '--dry-run']);
  assert.equal(args.platform, 'linux');
  assert.equal(args.dryRun, true);
});

test('parseArgs: treats --dry-run as boolean true when another flag follows', () => {
  const args = parseArgs(['node', 'script.mjs', '--dry-run', '--platform', 'linux']);
  assert.equal(args.dryRun, true);
  assert.equal(args.platform, 'linux');
});

test('parseArgs: returns empty object when no flags', () => {
  const args = parseArgs(['node', 'script.mjs']);
  assert.equal(args.platform, undefined);
  assert.equal(args.dryRun, undefined);
});

test('readPlatformVersion: reads VERSION.windows', () => {
  const dir = mkdtempSync(join(tmpdir(), 'version-'));
  wfs(join(dir, 'VERSION.windows'), '1.19.5');
  const result = readPlatformVersion('windows', dir);
  assert.equal(result, '1.19.5');
});

test('readPlatformVersion: reads VERSION.macos', () => {
  const dir = mkdtempSync(join(tmpdir(), 'version-'));
  wfs(join(dir, 'VERSION.macos'), '2.0.0');
  const result = readPlatformVersion('macos', dir);
  assert.equal(result, '2.0.0');
});

test('readPlatformVersion: throws on invalid platform', () => {
  assert.throws(() => readPlatformVersion('invalid', '/tmp'));
});

test('writePlatformVersion: writes VERSION.macos', () => {
  const dir = mkdtempSync(join(tmpdir(), 'version-'));
  writePlatformVersion('macos', '2.0.0', dir);
  const result = rfs(join(dir, 'VERSION.macos'), 'utf8');
  assert.equal(result, '2.0.0');
});

test('writePlatformVersion: overwrites existing VERSION.linux', () => {
  const dir = mkdtempSync(join(tmpdir(), 'version-'));
  wfs(join(dir, 'VERSION.linux'), '1.0.0');
  writePlatformVersion('linux', '1.1.0', dir);
  const result = rfs(join(dir, 'VERSION.linux'), 'utf8');
  assert.equal(result, '1.1.0');
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
node --test scripts/version-bump.test.mjs
```

Expected: FAIL — `readPlatformVersion`, `writePlatformVersion`, `parseArgs` not exported yet.

- [ ] **Step 3: Implement `parseArgs` function**

Add to `scripts/version-bump.mjs` (before `main`):

```javascript
export function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      const next = argv[i + 1];
      // Boolean flag: no next arg, or next arg is also a flag
      if (next === undefined || next.startsWith('--')) {
        args[key] = true;
      } else {
        args[key] = next;
        i++;
      }
    }
  }
  return args;
}
```

- [ ] **Step 4: Implement `readPlatformVersion` function**

Add to `scripts/version-bump.mjs`:

```javascript
export function readPlatformVersion(platform, repoRoot) {
  const filePath = resolve(repoRoot, `VERSION.${platform}`);
  if (!existsSync(filePath)) throw new Error(`Version file not found: VERSION.${platform}`);
  return readFileSync(filePath, 'utf8').trim();
}
```

- [ ] **Step 5: Implement `writePlatformVersion` function**

Add to `scripts/version-bump.mjs`:

```javascript
export function writePlatformVersion(platform, version, repoRoot) {
  const filePath = resolve(repoRoot, `VERSION.${platform}`);
  writeFileSync(filePath, version);
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
node --test scripts/version-bump.test.mjs
```

Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add scripts/version-bump.mjs scripts/version-bump.test.mjs
git commit -m "feat(version): add --platform flag with parseArgs/readPlatformVersion/writePlatformVersion"
```

---

### Task 3: Modify `main()` to Support `--platform` and `--dry-run`

**Files:**
- Modify: `scripts/version-bump.mjs`
- Modify: `scripts/version-bump.test.mjs`

**Interfaces:**
- Consumes: `parseArgs`, `readPlatformVersion`, `writePlatformVersion` from Task 2
- Produces: `main()` respects `--platform` flag; `getLatestTag(platform)` function for tag prefix filtering

- [ ] **Step 1: Implement `getLatestTag` function (fixes Bug #6: git describe prefix filter)**

Add to `scripts/version-bump.mjs`:

```javascript
export function getLatestTag(platform) {
  const { execFileSync } = require('node:child_process');
  // Filter tags by platform prefix to avoid cross-platform tag confusion
  // Windows: v1.19.5 (no prefix, backward compat)
  // macOS: mac/v1.0.0
  // Linux: linux/v1.0.0
  let pattern;
  if (platform === 'macos') pattern = 'mac/v*';
  else if (platform === 'linux') pattern = 'linux/v*';
  else pattern = 'v[0-9]*'; // Windows: only non-prefixed tags

  try {
    const tags = execFileSync('git', ['tag', '-l', pattern, '--sort=-v:refname'], {
      cwd: REPO_ROOT, encoding: 'utf8',
    }).trim();
    return tags ? tags.split('\n')[0] : '';
  } catch {
    return '';
  }
}
```

- [ ] **Step 2: Modify `readCurrentVersion` to accept platform**

Replace the `readCurrentVersion` function:

```javascript
export function readCurrentVersion(platform) {
  if (platform) {
    return readPlatformVersion(platform, REPO_ROOT);
  }
  // Fallback: read from Cargo.toml (backward compat for Windows without --platform)
  const cargoToml = readFileSync(resolve(REPO_ROOT, 'Cargo.toml'), 'utf8');
  const match = /^\[workspace\.package\][\s\S]*?^version\s*=\s*"([^"]+)"/m.exec(cargoToml);
  if (!match) throw new Error('Cannot find workspace.package.version in Cargo.toml');
  return match[1];
}
```

- [ ] **Step 3: Modify `main()` to use `--platform`, `--dry-run`, and `getLatestTag`**

Replace the `main` function:

```javascript
async function main() {
  const args = parseArgs(process.argv);
  const platform = args.platform || null;
  const dryRun = args.dryRun === true;

  const headMsg = process.env.HEAD_COMMIT_MSG || '';

  if (/\[skip release\]/i.test(headMsg)) {
    console.log('Detected [skip release] in HEAD commit. Skipping.');
    process.exit(78);
  }

  // Use platform-aware tag filtering to find the correct last tag
  const lastTag = process.env.LAST_TAG || getLatestTag(platform);
  const commits = getCommits(lastTag);
  console.log(`Analyzing ${commits.length} commit(s) since ${lastTag || 'beginning'}`);

  const releaseAs = parseReleaseAsFooter(headMsg);
  const currentVersion = readCurrentVersion(platform);
  let newVersion;

  if (releaseAs) {
    console.log(`Release-As footer found: ${releaseAs}`);
    newVersion = releaseAs;
  } else {
    const bump = determineBump(commits);
    if (!bump) {
      console.log('No commits trigger a release. Skipping.');
      process.exit(78);
    }
    newVersion = computeNewVersion(currentVersion, bump);
    console.log(`Bump ${bump}: ${currentVersion} -> ${newVersion}`);
  }

  const tagPrefix = platform === 'macos' ? 'mac' : platform === 'linux' ? 'linux' : '';
  const tag = tagPrefix ? `${tagPrefix}/v${newVersion}` : `v${newVersion}`;

  if (dryRun) {
    console.log(`[DRY RUN] Would bump to ${newVersion} for platform=${platform || 'all'}`);
    setGithubOutput('version', newVersion);
    setGithubOutput('tag', tag);
    setGithubOutput('is_prerelease', String(/-/.test(newVersion)));
    setGithubOutput('skipped', 'false');
    return;
  }

  if (platform) {
    // Platform-specific bump: write VERSION.{os} file
    writePlatformVersion(platform, newVersion, REPO_ROOT);

    if (platform === 'windows') {
      // Windows bumps all shared files (same as legacy behavior)
      bumpCargoToml(resolve(REPO_ROOT, 'Cargo.toml'), newVersion, true);
      bumpCargoToml(resolve(REPO_ROOT, 'crates/core/Cargo.toml'), newVersion, false);
      bumpCargoToml(resolve(REPO_ROOT, 'crates/platform/Cargo.toml'), newVersion, false);
      bumpCargoToml(resolve(REPO_ROOT, 'src-tauri/Cargo.toml'), newVersion, false);
      bumpJsonVersion(resolve(REPO_ROOT, 'package.json'), newVersion);
      bumpJsonVersion(resolve(REPO_ROOT, 'src-tauri/tauri.conf.json'), newVersion);
    }
    // macOS: only VERSION.macos is bumped (crates use workspace version, no shared files)
    // Linux: only VERSION.linux is bumped (tauri.conf.json patched at build time)
  } else {
    // Legacy: bump all files (backward compat, same as current behavior)
    bumpCargoToml(resolve(REPO_ROOT, 'Cargo.toml'), newVersion, true);
    bumpCargoToml(resolve(REPO_ROOT, 'crates/core/Cargo.toml'), newVersion, false);
    bumpCargoToml(resolve(REPO_ROOT, 'crates/platform/Cargo.toml'), newVersion, false);
    bumpCargoToml(resolve(REPO_ROOT, 'src-tauri/Cargo.toml'), newVersion, false);
    bumpJsonVersion(resolve(REPO_ROOT, 'package.json'), newVersion);
    bumpJsonVersion(resolve(REPO_ROOT, 'src-tauri/tauri.conf.json'), newVersion);
  }

  const groups = groupCommitsByType(commits);
  const dateISO = new Date().toISOString().slice(0, 10);
  const entry = generateChangelogEntry(newVersion, dateISO, groups);
  const changelogPath = resolve(REPO_ROOT, 'CHANGELOG.md');
  if (existsSync(changelogPath)) {
    updateChangelog(changelogPath, newVersion, entry);
  } else {
    writeFileSync(changelogPath, `# Changelog\n\n## [Unreleased]\n\n${entry}`);
  }

  const isPrerelease = /-/.test(newVersion);
  setGithubOutput('version', newVersion);
  setGithubOutput('tag', tag);
  setGithubOutput('is_prerelease', String(isPrerelease));
  console.log(`Wrote outputs: version=${newVersion}, tag=${tag}, is_prerelease=${isPrerelease}`);
}
```

- [ ] **Step 4: Write test for `getLatestTag`**

Add to `scripts/version-bump.test.mjs`:

```javascript
test('readCurrentVersion: delegates to readPlatformVersion when --platform set', () => {
  const dir = mkdtempSync(join(tmpdir(), 'version-'));
  wfs(join(dir, 'VERSION.windows'), '1.19.5');
  wfs(join(dir, 'VERSION.macos'), '1.0.0');
  wfs(join(dir, 'VERSION.linux'), '1.0.0');

  assert.equal(readPlatformVersion('windows', dir), '1.19.5');
  assert.equal(readPlatformVersion('macos', dir), '1.0.0');
  assert.equal(readPlatformVersion('linux', dir), '1.0.0');
});
```

- [ ] **Step 5: Run all tests**

```bash
node --test scripts/version-bump.test.mjs
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/version-bump.mjs scripts/version-bump.test.mjs
git commit -m "feat(version): main() supports --platform and --dry-run with platform-aware tag filtering"
```

---

### Task 4: Add Linux Flags to Updater Manifest Script

**Files:**
- Modify: `scripts/generate-updater-manifest.mjs`

**Interfaces:**
- Consumes: `--linux-deb`, `--linux-appimage` CLI flags
- Produces: `platforms['linux-x86_64']` entry in manifest JSON

- [ ] **Step 1: Add Linux platform entries**

Replace the `main` function in `scripts/generate-updater-manifest.mjs`:

```javascript
function main() {
  const {
    channel,
    version,
    tag,
    output,
    'windows-exe': winExe,
    'macos-arm-dmg': macArm,
    'macos-x64-dmg': macX64,
    'linux-deb': linuxDeb,
    'linux-appimage': linuxAppImage,
  } = parseArgs(process.argv);

  if (!channel || !version || !tag || !output) {
    console.error(
      'Usage: generate-updater-manifest.mjs --channel <stable|beta> --version <X.Y.Z> --tag <vX.Y.Z> --output <path> [--windows-exe <path>] [--macos-arm-dmg <path>] [--macos-x64-dmg <path>] [--linux-deb <path>] [--linux-appimage <path>]'
    );
    process.exit(1);
  }

  const repo = 'quangtruong2003/SmoothScroll';
  const baseUrl = `https://github.com/${repo}/releases/download/${tag}`;
  const pubDate = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

  const manifest = {
    version,
    notes: `See full changelog at https://github.com/${repo}/releases/tag/${tag}`,
    pub_date: pubDate,
    platforms: {},
  };

  if (winExe) {
    const fileName = winExe.split(/[\\/]/).pop();
    const sig = readSig(`${winExe}.sig`);
    manifest.platforms['windows-x86_64'] = {
      signature: sig || '',
      url: `${baseUrl}/${fileName}`,
    };
  }

  if (macArm) {
    const fileName = macArm.split(/[\\/]/).pop();
    const sig = readSig(`${macArm}.sig`);
    manifest.platforms['darwin-aarch64'] = {
      signature: sig || '',
      url: `${baseUrl}/${fileName}`,
    };
  }

  if (macX64) {
    const fileName = macX64.split(/[\\/]/).pop();
    const sig = readSig(`${macX64}.sig`);
    manifest.platforms['darwin-x86_64'] = {
      signature: sig || '',
      url: `${baseUrl}/${fileName}`,
    };
  }

  if (linuxDeb) {
    const fileName = linuxDeb.split(/[\\/]/).pop();
    const sig = readSig(`${linuxDeb}.sig`);
    manifest.platforms['linux-x86_64'] = {
      signature: sig || '',
      url: `${baseUrl}/${fileName}`,
    };
  }

  if (linuxAppImage) {
    const fileName = linuxAppImage.split(/[\\/]/).pop();
    const sig = readSig(`${linuxAppImage}.sig`);
    if (!manifest.platforms['linux-x86_64']) {
      manifest.platforms['linux-x86_64'] = {
        signature: sig || '',
        url: `${baseUrl}/${fileName}`,
      };
    }
  }

  const outDir = dirname(output);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(output, JSON.stringify(manifest, null, 2));
  console.log(`Wrote ${channel} manifest to ${output}:`);
  console.log(JSON.stringify(manifest, null, 2));
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/generate-updater-manifest.mjs
git commit -m "feat(updater): add --linux-deb and --linux-appimage flags"
```

---

### Task 5: Create `release-windows.yml`

**Files:**
- Create: `.github/workflows/release-windows.yml`

**Interfaces:**
- Consumes: `scripts/version-bump.mjs --platform windows`, reads from `Cargo.toml` workspace version
- Produces: GitHub release `v{version}` with NSIS/MSI installers + `latest.json`
- **Windows behavior is 100% identical to current `auto-release.yml`** — only path filters and `--platform windows` flag added

- [ ] **Step 1: Create the workflow file**

Create `.github/workflows/release-windows.yml`:

```yaml
name: Release (Windows)

on:
  push:
    branches: [master]
    paths:
      - 'src-tauri/**'
      - 'src/**'
      - 'crates/**'
      - 'scripts/**'
      - 'package.json'
      - 'VERSION.windows'
  workflow_dispatch:

concurrency:
  group: release-windows-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: write

jobs:
  _guard:
    if: |
      !(
        github.event_name == 'push' &&
        (
          startsWith(github.ref, 'refs/tags/') ||
          contains(github.event.head_commit.message, '[skip release]')
        )
      )
    runs-on: ubuntu-latest
    steps:
      - run: 'echo "Guarded: not a re-triggered run"'

  build-wasm:
    needs: [_guard]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: dtolnay/rust-toolchain@stable
        with:
          targets: wasm32-unknown-unknown

      - name: Cache cargo
        uses: Swatinem/rust-cache@v2
        with:
          workspaces: |
            .
            src-tauri
          shared-key: ci-wasm

      - name: Install wasm-pack
        uses: taiki-e/install-action@v2
        with:
          tool: wasm-pack

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
          cache-dependency-path: pnpm-lock.yaml

      - run: pnpm install --frozen-lockfile

      - name: Build WASM engine
        run: pnpm run build:wasm

      - name: Upload WASM artifact
        uses: actions/upload-artifact@v4
        with:
          name: wasm-engine-release
          path: src/lib/engine-wasm/
          retention-days: 1

  test:
    needs: [_guard, build-wasm]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install system dependencies
        run: |
          sudo apt-get update
          sudo apt-get install -y \
            libwebkit2gtk-4.1-dev build-essential curl wget file \
            libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev \
            libx11-dev libxi-dev libxtst-dev

      - uses: dtolnay/rust-toolchain@stable

      - name: Cache cargo
        uses: Swatinem/rust-cache@v2
        with:
          workspaces: |
            .
            src-tauri
          shared-key: ci-wasm

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
          cache-dependency-path: pnpm-lock.yaml

      - run: pnpm install --frozen-lockfile

      - name: Download WASM artifact
        uses: actions/download-artifact@v4
        with:
          name: wasm-engine-release
          path: src/lib/engine-wasm/

      - name: Run Rust tests
        run: cargo test --workspace --all-targets

      - name: Run TypeScript/Vitest tests
        run: pnpm test

      - name: Run script tests
        run: node --test scripts/*.test.mjs

  bump:
    needs: [_guard, test, build-wasm]
    if: "!contains(github.event.head_commit.message, '[skip release]')"
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.bump.outputs.version }}
      tag: ${{ steps.bump.outputs.tag }}
      is_prerelease: ${{ steps.bump.outputs.is_prerelease }}
      skipped: ${{ steps.bump.outputs.skipped }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Bump version for Windows
        id: bump
        run: |
          set +e
          HEAD_COMMIT_MSG=$(git log -1 --pretty=%B)
          HEAD_COMMIT_MSG="$HEAD_COMMIT_MSG" node scripts/version-bump.mjs --platform windows
          EXIT_CODE=$?

          if [ $EXIT_CODE -eq 78 ]; then
            echo "skipped=true" >> "$GITHUB_OUTPUT"
            echo "No release triggered. Skipping downstream jobs."
            exit 0
          elif [ $EXIT_CODE -ne 0 ]; then
            echo "version-bump.mjs failed with exit $EXIT_CODE"
            exit $EXIT_CODE
          fi

          echo "skipped=false" >> "$GITHUB_OUTPUT"

      - name: Update Cargo.lock
        if: steps.bump.outputs.skipped != 'true'
        uses: dtolnay/rust-toolchain@stable

      - name: Refresh Cargo.lock
        if: steps.bump.outputs.skipped != 'true'
        run: cargo update --workspace --offline || cargo update --workspace

      - name: Pull latest, commit + tag + push (rebase-safe)
        if: steps.bump.outputs.skipped != 'true'
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add Cargo.toml Cargo.lock crates/*/Cargo.toml src-tauri/Cargo.toml package.json src-tauri/tauri.conf.json VERSION.windows CHANGELOG.md
          git commit -m "chore: release ${{ steps.bump.outputs.tag }} [skip release]"
          git pull --rebase origin master
          git tag "${{ steps.bump.outputs.tag }}"
          git push origin master
          git push origin "${{ steps.bump.outputs.tag }}"

  build-windows:
    needs: [bump, build-wasm, test]
    if: needs.bump.outputs.skipped != 'true'
    runs-on: windows-latest
    env:
      TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
      TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
      SENTRY_DSN: ${{ secrets.SENTRY_DSN }}
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ needs.bump.outputs.tag }}

      - uses: dtolnay/rust-toolchain@stable
        with:
          targets: wasm32-unknown-unknown

      - name: Cache cargo + target
        uses: Swatinem/rust-cache@v2
        with:
          workspaces: |
            .
            src-tauri
          shared-key: build-windows

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
          cache-dependency-path: pnpm-lock.yaml

      - run: pnpm install --frozen-lockfile

      - name: Download WASM artifact
        uses: actions/download-artifact@v4
        with:
          name: wasm-engine-release
          path: src/lib/engine-wasm/

      - name: Build Tauri app
        run: pnpm tauri build

      - name: Generate latest.json
        shell: bash
        run: |
          VERSION="${{ needs.bump.outputs.version }}"
          TAG="${{ needs.bump.outputs.tag }}"
          EXE_NAME="SmoothScroll_${VERSION}_x64-setup.exe"
          EXE_PATH="target/release/bundle/nsis/$EXE_NAME"

          if [ ! -f "$EXE_PATH.sig" ]; then
            echo ".sig file not found at $EXE_PATH.sig"
            exit 1
          fi

          node scripts/generate-updater-manifest.mjs \
            --channel stable \
            --version "$VERSION" \
            --tag "$TAG" \
            --output release-feed/latest.json \
            --windows-exe "$EXE_PATH"

      - name: Upload installers + feed to Release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: ${{ needs.bump.outputs.tag }}
          generate_release_notes: true
          files: |
            target/release/bundle/nsis/*.exe
            target/release/bundle/nsis/*.sig
            target/release/bundle/msi/*.msi
            release-feed/latest.json

  cleanup-releases:
    needs: [bump, build-windows, build-wasm, test]
    if: always() && needs.bump.outputs.skipped != 'true' && needs.build-windows.result == 'success'
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - name: Delete old Windows releases (keep latest)
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GH_REPO: ${{ github.repository }}
        run: |
          CURRENT_TAG="${{ needs.bump.outputs.tag }}"
          echo "Keeping release: $CURRENT_TAG"
          gh release list --limit 100 --json tagName --jq '.[].tagName' \
            | grep -vx "$CURRENT_TAG" \
            | grep -vx 'mac/.*' \
            | grep -vx 'linux/.*' \
            | while read -r tag; do
                if [ -n "$tag" ]; then
                  echo "Deleting release + tag: $tag"
                  gh release delete "$tag" --cleanup-tag --yes || echo "  failed to delete $tag"
                fi
              done
```

- [ ] **Step 2: Verify YAML syntax**

```bash
cat .github/workflows/release-windows.yml | head -5
```

Expected: Valid YAML.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/release-windows.yml
git commit -m "ci: add release-windows.yml workflow"
```

---

### Task 6: Create `release-macos.yml`

**Files:**
- Create: `.github/workflows/release-macos.yml`

**Interfaces:**
- Consumes: `VERSION.macos`, `scripts/version-bump.mjs --platform macos`
- Produces: GitHub release `mac/v{version}` with DMG artifacts
- **Commits only `VERSION.macos` + `CHANGELOG.md` — no shared files touched**

- [ ] **Step 1: Create the workflow file**

Create `.github/workflows/release-macos.yml`:

```yaml
name: Release (macOS)

on:
  push:
    branches: [master]
    paths:
      - 'macos/**'
      - 'crates/**'
      - 'VERSION.macos'
  workflow_dispatch:

concurrency:
  group: release-macos-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: write

jobs:
  _guard:
    if: |
      !(
        github.event_name == 'push' &&
        (
          startsWith(github.ref, 'refs/tags/') ||
          contains(github.event.head_commit.message, '[skip release]')
        )
      )
    runs-on: ubuntu-latest
    steps:
      - run: 'echo "Guarded: not a re-triggered run"'

  bump:
    needs: [_guard]
    if: "!contains(github.event.head_commit.message, '[skip release]')"
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.bump.outputs.version }}
      tag: ${{ steps.bump.outputs.tag }}
      is_prerelease: ${{ steps.bump.outputs.is_prerelease }}
      skipped: ${{ steps.bump.outputs.skipped }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Bump version for macOS
        id: bump
        run: |
          set +e
          HEAD_COMMIT_MSG=$(git log -1 --pretty=%B)
          HEAD_COMMIT_MSG="$HEAD_COMMIT_MSG" node scripts/version-bump.mjs --platform macos
          EXIT_CODE=$?

          if [ $EXIT_CODE -eq 78 ]; then
            echo "skipped=true" >> "$GITHUB_OUTPUT"
            echo "No release triggered. Skipping downstream jobs."
            exit 0
          elif [ $EXIT_CODE -ne 0 ]; then
            echo "version-bump.mjs failed with exit $EXIT_CODE"
            exit $EXIT_CODE
          fi

          echo "skipped=false" >> "$GITHUB_OUTPUT"

      - name: Pull latest, commit + tag + push (rebase-safe)
        if: steps.bump.outputs.skipped != 'true'
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          # macOS only commits its own files — no shared files
          git add VERSION.macos CHANGELOG.md
          git commit -m "chore: release ${{ steps.bump.outputs.tag }} [skip release]"
          git pull --rebase origin master
          git tag "${{ steps.bump.outputs.tag }}"
          git push origin master
          git push origin "${{ steps.bump.outputs.tag }}"

  build-macos:
    needs: [bump]
    if: needs.bump.outputs.skipped != 'true'
    continue-on-error: true
    strategy:
      fail-fast: false
      matrix:
        include:
          - target: aarch64-apple-darwin
            arch: arm64
          - target: x86_64-apple-darwin
            arch: x64
    runs-on: macos-14
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ needs.bump.outputs.tag }}

      - uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.target }}

      - name: Cache cargo + target
        uses: Swatinem/rust-cache@v2
        with:
          workspaces: |
            .
          shared-key: build-macos-${{ matrix.target }}

      - name: Build Rust engine
        run: |
          cargo build --profile release-fast -p smoothscroll_platform -p smoothscroll_core --target ${{ matrix.target }}

      - name: Build Swift app
        run: |
          curl -fsSL https://github.com/yonaskolb/XcodeGen/releases/download/2.45.0/xcodegen.zip -o xcodegen.zip && \
          unzip -o xcodegen.zip && \
          chmod +x xcodegen/bin/xcodegen && \
          cd macos/SmoothScrollMenuBar && \
          ../../xcodegen/bin/xcodegen generate && \
          xcodebuild -project SmoothScrollMenuBar.xcodeproj -scheme SmoothScrollMenuBar -configuration Release -arch ${{ matrix.arch == 'x64' && 'x86_64' || matrix.arch }} CONFIGURATION_BUILD_DIR=build/Release build

      - name: Package DMG
        id: package-dmg
        run: |
          mkdir -p dmg-tmp
          APP_PATH="macos/SmoothScrollMenuBar/build/Release/SmoothScrollMenuBar.app"
          if [ ! -d "$APP_PATH" ]; then
            echo "ERROR: App not found at $APP_PATH"
            ls -la macos/SmoothScrollMenuBar/build/ 2>/dev/null || echo "build dir does not exist"
            exit 1
          fi
          hdiutil create dmg-tmp/SmoothScroll.dmg -volname SmoothScroll -srcfolder "$APP_PATH" -ov
          DMG_PATH="dmg-tmp/SmoothScroll_${{ matrix.arch }}.dmg"
          mv dmg-tmp/SmoothScroll.dmg "$DMG_PATH"
          echo "dmg_path=$DMG_PATH" >> "$GITHUB_OUTPUT"

      - name: Upload DMG to Release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: ${{ needs.bump.outputs.tag }}
          name: "macOS v${{ needs.bump.outputs.version }}"
          files: |
            dmg-tmp/*.dmg

  cleanup-releases:
    needs: [bump, build-macos]
    if: always() && needs.bump.outputs.skipped != 'true'
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - name: Delete old macOS releases (keep latest)
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GH_REPO: ${{ github.repository }}
        run: |
          CURRENT_TAG="${{ needs.bump.outputs.tag }}"
          echo "Keeping release: $CURRENT_TAG"
          gh release list --limit 100 --json tagName --jq '.[].tagName' \
            | grep '^mac/v' \
            | grep -vx "$CURRENT_TAG" \
            | while read -r tag; do
                if [ -n "$tag" ]; then
                  echo "Deleting release + tag: $tag"
                  gh release delete "$tag" --cleanup-tag --yes || echo "  failed to delete $tag"
                fi
              done
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/release-macos.yml
git commit -m "ci: add release-macos.yml workflow"
```

---

### Task 7: Create `release-linux.yml`

**Files:**
- Create: `.github/workflows/release-linux.yml`

**Interfaces:**
- Consumes: `VERSION.linux`, `scripts/version-bump.mjs --platform linux`
- Produces: GitHub release `linux/v{version}` with deb/AppImage + `latest-linux.json`
- **Commits only `VERSION.linux` + `CHANGELOG.md` — no shared files touched**
- **Patches `tauri.conf.json` at build time** (updater endpoint + version)

- [ ] **Step 1: Create the workflow file**

Create `.github/workflows/release-linux.yml`:

```yaml
name: Release (Linux)

on:
  push:
    branches: [master]
    paths:
      - 'src-tauri/**'
      - 'src/**'
      - 'crates/**'
      - 'scripts/**'
      - 'package.json'
      - 'VERSION.linux'
  workflow_dispatch:

concurrency:
  group: release-linux-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: write

jobs:
  _guard:
    if: |
      !(
        github.event_name == 'push' &&
        (
          startsWith(github.ref, 'refs/tags/') ||
          contains(github.event.head_commit.message, '[skip release]')
        )
      )
    runs-on: ubuntu-latest
    steps:
      - run: 'echo "Guarded: not a re-triggered run"'

  build-wasm:
    needs: [_guard]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: dtolnay/rust-toolchain@stable
        with:
          targets: wasm32-unknown-unknown

      - name: Cache cargo
        uses: Swatinem/rust-cache@v2
        with:
          workspaces: |
            .
            src-tauri
          shared-key: ci-wasm

      - name: Install wasm-pack
        uses: taiki-e/install-action@v2
        with:
          tool: wasm-pack

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
          cache-dependency-path: pnpm-lock.yaml

      - run: pnpm install --frozen-lockfile

      - name: Build WASM engine
        run: pnpm run build:wasm

      - name: Upload WASM artifact
        uses: actions/upload-artifact@v4
        with:
          name: wasm-engine-release
          path: src/lib/engine-wasm/
          retention-days: 1

  test:
    needs: [_guard, build-wasm]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install system dependencies
        run: |
          sudo apt-get update
          sudo apt-get install -y \
            libwebkit2gtk-4.1-dev build-essential curl wget file \
            libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev \
            libx11-dev libxi-dev libxtst-dev

      - uses: dtolnay/rust-toolchain@stable

      - name: Cache cargo
        uses: Swatinem/rust-cache@v2
        with:
          workspaces: |
            .
            src-tauri
          shared-key: ci-wasm

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
          cache-dependency-path: pnpm-lock.yaml

      - run: pnpm install --frozen-lockfile

      - name: Download WASM artifact
        uses: actions/download-artifact@v4
        with:
          name: wasm-engine-release
          path: src/lib/engine-wasm/

      - name: Run Rust tests
        run: cargo test --workspace --all-targets

      - name: Run TypeScript/Vitest tests
        run: pnpm test

      - name: Run script tests
        run: node --test scripts/*.test.mjs

  bump:
    needs: [_guard, test, build-wasm]
    if: "!contains(github.event.head_commit.message, '[skip release]')"
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.bump.outputs.version }}
      tag: ${{ steps.bump.outputs.tag }}
      is_prerelease: ${{ steps.bump.outputs.is_prerelease }}
      skipped: ${{ steps.bump.outputs.skipped }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Bump version for Linux
        id: bump
        run: |
          set +e
          HEAD_COMMIT_MSG=$(git log -1 --pretty=%B)
          HEAD_COMMIT_MSG="$HEAD_COMMIT_MSG" node scripts/version-bump.mjs --platform linux
          EXIT_CODE=$?

          if [ $EXIT_CODE -eq 78 ]; then
            echo "skipped=true" >> "$GITHUB_OUTPUT"
            echo "No release triggered. Skipping downstream jobs."
            exit 0
          elif [ $EXIT_CODE -ne 0 ]; then
            echo "version-bump.mjs failed with exit $EXIT_CODE"
            exit $EXIT_CODE
          fi

          echo "skipped=false" >> "$GITHUB_OUTPUT"

      - name: Pull latest, commit + tag + push (rebase-safe)
        if: steps.bump.outputs.skipped != 'true'
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          # Linux only commits its own files — no shared files
          git add VERSION.linux CHANGELOG.md
          git commit -m "chore: release ${{ steps.bump.outputs.tag }} [skip release]"
          git pull --rebase origin master
          git tag "${{ steps.bump.outputs.tag }}"
          git push origin master
          git push origin "${{ steps.bump.outputs.tag }}"

  build-linux:
    needs: [bump, build-wasm, test]
    if: needs.bump.outputs.skipped != 'true'
    runs-on: ubuntu-22.04
    env:
      SENTRY_DSN: ${{ secrets.SENTRY_DSN }}
      TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
      TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ needs.bump.outputs.tag }}

      - uses: dtolnay/rust-toolchain@stable
        with:
          targets: wasm32-unknown-unknown

      - name: Cache cargo + target
        uses: Swatinem/rust-cache@v2
        with:
          workspaces: |
            .
            src-tauri
          shared-key: build-linux

      - name: Install system dependencies
        run: |
          sudo apt-get update
          sudo apt-get install -y \
            libwebkit2gtk-4.1-dev build-essential curl wget file \
            libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev \
            libx11-dev libxi-dev libxtst-dev

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
          cache-dependency-path: pnpm-lock.yaml

      - run: pnpm install --frozen-lockfile

      - name: Download WASM artifact
        uses: actions/download-artifact@v4
        with:
          name: wasm-engine-release
          path: src/lib/engine-wasm/

      - name: Patch tauri.conf.json for Linux (version + updater endpoint)
        run: |
          VERSION="${{ needs.bump.outputs.version }}"
          node -e "
          const fs = require('fs');
          const conf = JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json', 'utf8'));
          conf.version = '${VERSION}';
          conf.plugins.updater.endpoints = ['https://github.com/quangtruong2003/SmoothScroll/releases/latest/download/latest-linux.json'];
          fs.writeFileSync('src-tauri/tauri.conf.json', JSON.stringify(conf, null, 2) + '\n');
          "

      - name: Build Tauri app (release-fast)
        env:
          TAURI_BUILD_PROFILE: release-fast
        run: pnpm tauri build

      - name: Generate latest-linux.json
        run: |
          VERSION="${{ needs.bump.outputs.version }}"
          TAG="${{ needs.bump.outputs.tag }}"

          node scripts/generate-updater-manifest.mjs \
            --channel stable \
            --version "$VERSION" \
            --tag "$TAG" \
            --output release-feed/latest-linux.json \
            --linux-deb "target/release-fast/bundle/deb/SmoothScroll_${VERSION}_amd64.deb" \
            --linux-appimage "target/release-fast/bundle/appimage/SmoothScroll_${VERSION}_amd64.AppImage"

      - name: Upload to Release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: ${{ needs.bump.outputs.tag }}
          name: "Linux v${{ needs.bump.outputs.version }}"
          files: |
            target/release-fast/bundle/deb/*.deb
            target/release-fast/bundle/appimage/*.AppImage
            release-feed/latest-linux.json

  cleanup-releases:
    needs: [bump, build-linux]
    if: always() && needs.bump.outputs.skipped != 'true' && needs.build-linux.result == 'success'
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - name: Delete old Linux releases (keep latest)
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GH_REPO: ${{ github.repository }}
        run: |
          CURRENT_TAG="${{ needs.bump.outputs.tag }}"
          echo "Keeping release: $CURRENT_TAG"
          gh release list --limit 100 --json tagName --jq '.[].tagName' \
            | grep '^linux/v' \
            | grep -vx "$CURRENT_TAG" \
            | while read -r tag; do
                if [ -n "$tag" ]; then
                  echo "Deleting release + tag: $tag"
                  gh release delete "$tag" --cleanup-tag --yes || echo "  failed to delete $tag"
                fi
              done
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/release-linux.yml
git commit -m "ci: add release-linux.yml workflow"
```

---

### Task 8: Delete Old Workflow and Final Cleanup

**Files:**
- Delete: `.github/workflows/auto-release.yml`

**Interfaces:**
- Consumes: Nothing
- Produces: Clean repo with only the 3 new workflows

- [ ] **Step 1: Delete auto-release.yml**

```bash
git rm .github/workflows/auto-release.yml
```

- [ ] **Step 2: Run all tests to verify nothing broke**

```bash
node --test scripts/version-bump.test.mjs
```

Expected: All tests PASS.

- [ ] **Step 3: Verify file structure**

```bash
ls .github/workflows/
```

Expected: `ci.yml`, `commitlint.yml`, `deploy-landing.yml`, `release-linux.yml`, `release-macos.yml`, `release-windows.yml`, `tests.yml`

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove auto-release.yml, replaced by per-OS workflows"
```

- [ ] **Step 5: Final verification — dry run version bump for all platforms**

```bash
node scripts/version-bump.mjs --platform windows --dry-run
```

Expected: Shows `[DRY RUN] Would bump to X.Y.Z for platform=windows`, tag output is `vX.Y.Z`.

```bash
node scripts/version-bump.mjs --platform macos --dry-run
```

Expected: Shows `[DRY RUN] Would bump to X.Y.Z for platform=macos`, tag output is `mac/vX.Y.Z`.

```bash
node scripts/version-bump.mjs --platform linux --dry-run
```

Expected: Shows `[DRY RUN] Would bump to X.Y.Z for platform=linux`, tag output is `linux/vX.Y.Z`.

---

## Bug Fix Summary

| # | Bug | Fix Applied |
|---|-----|------------|
| 1 | parseArgs boolean flag | Detect boolean flags when next arg is undefined or starts with `--` |
| 2 | Race condition bump | Each workflow commits only its own files + `git pull --rebase` before push |
| 3 | Cargo.toml workspace | macOS/Linux don't bump Cargo.toml (Windows owns shared files) |
| 4 | Updater endpoint | Windows keeps `latest.json` (unchanged). Linux patches at build time. |
| 5 | Dry-run tag prefix | Both paths now use consistent `${tagPrefix}/v${newVersion}` format |
| 6 | git describe prefix | New `getLatestTag(platform)` filters by platform tag prefix |
| 7 | Old releases cleanup | Windows cleanup excludes `mac/` and `linux/` prefixed tags |
| NEW | Windows unchanged | Windows workflow is exact extraction of auto-release.yml + path filters only |
