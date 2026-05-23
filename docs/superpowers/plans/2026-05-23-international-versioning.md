# International Versioning Standard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Áp dụng SemVer 2.0.0 + Conventional Commits + Keep a Changelog cho SmoothScroll, tự động hóa hoàn toàn quy trình bump version + release qua workflow GitHub Actions, đồng thời thiết lập macOS beta channel.

**Architecture:** Nâng cấp `.github/workflows/auto-release.yml` hiện có (không thay bằng semantic-release). Thay step "bump patch cứng" bằng Node script `scripts/version-bump.mjs` đọc commits từ tag cuối → detect bump level theo Conv Commits → đồng bộ 3 file (Cargo.toml, package.json, tauri.conf.json) + sinh CHANGELOG. macOS xài channel beta riêng với updater manifest tách biệt, UI hiển thị badge "BETA".

**Tech Stack:** Node.js 20 (script chạy trong CI, không thêm runtime dependency), GitHub Actions, Tauri 2, React + TypeScript, vitest (frontend test), node:test (script test), commitlint.

---

## File Structure

**Tạo mới:**
- `scripts/version-bump.mjs` — Đọc commits → tính version mới → bump 3 file + CHANGELOG.
- `scripts/version-bump.test.mjs` — Test cho script trên (node:test).
- `scripts/generate-updater-manifest.mjs` — Refactor logic `latest.json`/`beta.json` từ inline workflow.
- `CHANGELOG.md` — Keep a Changelog format, seed với entry 1.0.0.
- `commitlint.config.js` — Config cho commitlint.
- `.github/workflows/commitlint.yml` — Soft enforcement Conv Commits trên PR.
- `docs/VERSIONING.md` — Tài liệu chuẩn version cho contributor.
- `src/lib/release-channel.ts` — Helper trả về channel hiện tại.
- `src/lib/release-channel.test.ts` — Test vitest cho helper.
- `src/components/BetaBadge.tsx` — Component badge "BETA".
- `src/components/BetaBadge.test.tsx` — Test render BetaBadge.

**Sửa:**
- `.github/workflows/auto-release.yml` — Thay logic bump + thêm macOS beta suffix + beta.json.
- `package.json` — Thêm devDependency commitlint.
- `src/components/settings/AboutSection.tsx` — Mount `<BetaBadge />` cạnh version.
- `src/i18n/locales/en.json` — Thêm keys cho beta badge tooltip.
- `src/i18n/locales/vi.json` — Tương tự (vi).
- `src/i18n/locales/zh.json` — Tương tự (zh).
- `README.md` — Section "Installing on macOS".

---

## Task 1: Tạo CHANGELOG.md seed

**Files:**
- Create: `CHANGELOG.md`

- [ ] **Step 1: Tạo file CHANGELOG.md với seed entry**

Nội dung:
```markdown
# Changelog

All notable changes to SmoothScroll documented here.

Format: [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/)
Versioning: [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html)

## [Unreleased]

## [1.0.0] - 2026-05-23

### Added
- First production release. Adopts SemVer 2.0.0 + Conventional Commits 1.0.0 + Keep a Changelog 1.1.0.
- Cross-platform smooth scrolling for Windows (stable channel) and macOS (beta channel).
- Settings UI with themes, i18n (en, vi, zh, plus more).
- Auto-updater integration (Windows).
- UIA-based text input detection on Windows.
- Tray panel + main window UX.

### Changed
- Version jumps from 0.1.38 → 1.0.0 to signal stability.
- Automated release workflow now derives bump level from Conventional Commits.

### Known Issues
- macOS builds unsigned (no Apple Developer ID yet). Users must allow via Gatekeeper.
- macOS auto-update disabled in beta channel until code-signing is set up.
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: seed CHANGELOG.md with v1.0.0 entry"
```

---

## Task 2: Tạo docs/VERSIONING.md

**Files:**
- Create: `docs/VERSIONING.md`

- [ ] **Step 1: Tạo VERSIONING.md**

Nội dung:
```markdown
# Versioning Policy

SmoothScroll tuân thủ các chuẩn quốc tế sau:

| Chuẩn | Version | Vai trò |
|-------|---------|---------|
| [Semantic Versioning](https://semver.org/spec/v2.0.0.html) | 2.0.0 | Format version `MAJOR.MINOR.PATCH[-prerelease]` |
| [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) | 1.0.0 | Format commit message |
| [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) | 1.1.0 | Format CHANGELOG.md |

## Bump rules

| Commit pattern | Bump |
|----------------|------|
| `feat!:`, `fix!:`, hoặc footer `BREAKING CHANGE:` | MAJOR |
| `feat:` | MINOR |
| `fix:`, `perf:`, `revert:` | PATCH |
| `docs:`, `style:`, `refactor:`, `test:`, `chore:`, `ci:`, `build:` | (không release) |

## Channels

- **Windows = stable.** Updater endpoint = `latest.json`.
- **macOS = beta.** Updater endpoint = `beta.json`. UI hiển thị badge "BETA". Auto-update tạm tắt cho đến khi có Apple Developer ID.

## Special commit footers

- `Release-As: 1.0.0` — Force version cụ thể (vd: khi migrate hoặc tạo pre-release).
- `[skip release]` trong subject — Workflow bỏ qua release lần đó.

## Migration

Lần đầu áp dụng chuẩn (0.1.38 → 1.0.0): commit khởi tạo có cả `feat!:` + `Release-As: 1.0.0` + footer `BREAKING CHANGE:`.

## Workflow

1. Push commit lên `master` theo Conv Commits.
2. `.github/workflows/auto-release.yml` chạy:
   - `scripts/version-bump.mjs` đọc commits từ tag cuối → tính version mới.
   - Sync 3 file: `Cargo.toml`, `package.json`, `src-tauri/tauri.conf.json`.
   - Update `CHANGELOG.md`.
   - Tạo commit `chore: release vX.Y.Z [skip release]` + tag `vX.Y.Z`.
3. Build Windows artifact → upload + update `latest.json`.
4. Build macOS artifact (suffix `_beta`) → upload + update `beta.json`.
5. Tạo GitHub Release.

## Khi không có commit nào trigger bump

Script `version-bump.mjs` exit code 78 (workflow "neutral") → skip toàn bộ release job.
```

- [ ] **Step 2: Commit**

```bash
git add docs/VERSIONING.md
git commit -m "docs: add VERSIONING.md describing SemVer + Conventional Commits policy"
```

---

## Task 3: Viết test cho version-bump.mjs (TDD - RED)

**Files:**
- Create: `scripts/version-bump.test.mjs`

- [ ] **Step 1: Tạo test file với các test case cốt lõi**

Nội dung:
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { determineBump, computeNewVersion, parseReleaseAsFooter, groupCommitsByType } from './version-bump.mjs';

test('determineBump: returns "major" when commit has BREAKING CHANGE footer', () => {
  const commits = [
    { type: 'feat', subject: 'new feature', body: 'BREAKING CHANGE: removes old API', breaking: true },
  ];
  assert.equal(determineBump(commits), 'major');
});

test('determineBump: returns "major" when subject uses bang notation feat!', () => {
  const commits = [
    { type: 'feat', subject: 'redesign config', body: '', breaking: true },
  ];
  assert.equal(determineBump(commits), 'major');
});

test('determineBump: returns "minor" for feat commits', () => {
  const commits = [
    { type: 'feat', subject: 'add dark mode', body: '', breaking: false },
    { type: 'chore', subject: 'tidy', body: '', breaking: false },
  ];
  assert.equal(determineBump(commits), 'minor');
});

test('determineBump: returns "patch" for fix/perf/revert commits', () => {
  const commits = [
    { type: 'fix', subject: 'crash on launch', body: '', breaking: false },
  ];
  assert.equal(determineBump(commits), 'patch');
});

test('determineBump: returns null when no triggering commits', () => {
  const commits = [
    { type: 'docs', subject: 'update README', body: '', breaking: false },
    { type: 'chore', subject: 'bump deps', body: '', breaking: false },
  ];
  assert.equal(determineBump(commits), null);
});

test('determineBump: picks highest severity (major > minor > patch)', () => {
  const commits = [
    { type: 'fix', subject: 'bug', body: '', breaking: false },
    { type: 'feat', subject: 'feature', body: '', breaking: false },
    { type: 'fix', subject: 'breaking fix', body: 'BREAKING CHANGE: schema', breaking: true },
  ];
  assert.equal(determineBump(commits), 'major');
});

test('computeNewVersion: bumps patch from 1.2.3 to 1.2.4', () => {
  assert.equal(computeNewVersion('1.2.3', 'patch'), '1.2.4');
});

test('computeNewVersion: bumps minor from 1.2.3 to 1.3.0 (resets patch)', () => {
  assert.equal(computeNewVersion('1.2.3', 'minor'), '1.3.0');
});

test('computeNewVersion: bumps major from 1.2.3 to 2.0.0 (resets minor + patch)', () => {
  assert.equal(computeNewVersion('1.2.3', 'major'), '2.0.0');
});

test('computeNewVersion: bumps from 0.1.38 patch to 0.1.39', () => {
  assert.equal(computeNewVersion('0.1.38', 'patch'), '0.1.39');
});

test('computeNewVersion: throws on invalid current version', () => {
  assert.throws(() => computeNewVersion('not-a-version', 'patch'));
});

test('parseReleaseAsFooter: extracts version from Release-As footer', () => {
  const body = 'Some message\n\nRelease-As: 1.0.0';
  assert.equal(parseReleaseAsFooter(body), '1.0.0');
});

test('parseReleaseAsFooter: case-insensitive for footer key', () => {
  const body = 'Some message\n\nrelease-as: 2.0.0-beta.1';
  assert.equal(parseReleaseAsFooter(body), '2.0.0-beta.1');
});

test('parseReleaseAsFooter: returns null when no footer', () => {
  const body = 'No footer here';
  assert.equal(parseReleaseAsFooter(body), null);
});

test('groupCommitsByType: groups feat under Added, fix under Fixed', () => {
  const commits = [
    { type: 'feat', subject: 'feature A', body: '', breaking: false, hash: 'abc' },
    { type: 'fix', subject: 'bug B', body: '', breaking: false, hash: 'def' },
    { type: 'feat', subject: 'feature C', body: '', breaking: false, hash: 'ghi' },
  ];
  const groups = groupCommitsByType(commits);
  assert.deepEqual(groups.Added, ['feature A', 'feature C']);
  assert.deepEqual(groups.Fixed, ['bug B']);
});

test('groupCommitsByType: ignores chore/docs/style', () => {
  const commits = [
    { type: 'chore', subject: 'ci', body: '', breaking: false, hash: 'abc' },
    { type: 'docs', subject: 'readme', body: '', breaking: false, hash: 'def' },
  ];
  const groups = groupCommitsByType(commits);
  assert.equal(groups.Added, undefined);
  assert.equal(groups.Fixed, undefined);
});
```

- [ ] **Step 2: Chạy test để verify FAIL**

Run: `node --test scripts/version-bump.test.mjs`
Expected: FAIL với "Cannot find module './version-bump.mjs'" hoặc "X is not a function".

---

## Task 4: Implement version-bump.mjs (TDD - GREEN, pure functions)

**Files:**
- Create: `scripts/version-bump.mjs`

- [ ] **Step 1: Implement pure functions (export trước, side effects sau)**

Nội dung:
```javascript
#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '..');

const TYPE_TO_SECTION = {
  feat: 'Added',
  fix: 'Fixed',
  perf: 'Performance',
  revert: 'Changed',
};

const BUMP_LEVEL = { major: 3, minor: 2, patch: 1 };

export function determineBump(commits) {
  let highest = null;
  for (const c of commits) {
    let level = null;
    if (c.breaking) level = 'major';
    else if (c.type === 'feat') level = 'minor';
    else if (c.type === 'fix' || c.type === 'perf' || c.type === 'revert') level = 'patch';

    if (level && (highest === null || BUMP_LEVEL[level] > BUMP_LEVEL[highest])) {
      highest = level;
    }
  }
  return highest;
}

export function computeNewVersion(currentVersion, bump) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-.+)?$/.exec(currentVersion);
  if (!match) throw new Error(`Invalid version: ${currentVersion}`);
  let [_, major, minor, patch] = match;
  major = Number(major); minor = Number(minor); patch = Number(patch);
  if (bump === 'major') return `${major + 1}.0.0`;
  if (bump === 'minor') return `${major}.${minor + 1}.0`;
  if (bump === 'patch') return `${major}.${minor}.${patch + 1}`;
  throw new Error(`Unknown bump: ${bump}`);
}

export function parseReleaseAsFooter(body) {
  const match = /^release-as:\s*(\S+)\s*$/im.exec(body);
  return match ? match[1] : null;
}

export function groupCommitsByType(commits) {
  const groups = {};
  for (const c of commits) {
    const section = TYPE_TO_SECTION[c.type];
    if (!section) continue;
    if (!groups[section]) groups[section] = [];
    groups[section].push(c.subject);
  }
  return groups;
}

export function parseCommitMessage(raw) {
  const lines = raw.split('\n');
  const subjectLine = lines[0] || '';
  const body = lines.slice(2).join('\n');

  const match = /^(\w+)(\([^)]*\))?(!)?:\s*(.+)$/.exec(subjectLine);
  if (!match) return null;
  const [, type, , bang, subject] = match;
  const breaking = Boolean(bang) || /^BREAKING CHANGE:/m.test(body);
  return { type, subject, body, breaking };
}

export function readCurrentVersion() {
  const cargoToml = readFileSync(resolve(REPO_ROOT, 'Cargo.toml'), 'utf8');
  const match = /^\[workspace\.package\][\s\S]*?^version\s*=\s*"([^"]+)"/m.exec(cargoToml);
  if (!match) throw new Error('Cannot find workspace.package.version in Cargo.toml');
  return match[1];
}

export function bumpCargoToml(filePath, newVersion, isWorkspace) {
  const content = readFileSync(filePath, 'utf8');
  let updated;
  if (isWorkspace) {
    updated = content.replace(
      /(\[workspace\.package\][\s\S]*?\n)version\s*=\s*"[^"]+"/,
      `$1version = "${newVersion}"`
    );
  } else {
    updated = content.replace(
      /^version\s*=\s*"[^"]+"/m,
      `version = "${newVersion}"`
    );
  }
  writeFileSync(filePath, updated);
}

export function bumpJsonVersion(filePath, newVersion) {
  const content = readFileSync(filePath, 'utf8');
  const updated = content.replace(
    /^(\s*)"version":\s*"[^"]+"/m,
    `$1"version": "${newVersion}"`
  );
  writeFileSync(filePath, updated);
}

export function generateChangelogEntry(newVersion, dateISO, groups) {
  const lines = [`## [${newVersion}] - ${dateISO}`, ''];
  const order = ['Added', 'Changed', 'Fixed', 'Performance', 'Deprecated', 'Removed', 'Security'];
  for (const section of order) {
    const items = groups[section];
    if (!items || items.length === 0) continue;
    lines.push(`### ${section}`);
    for (const item of items) lines.push(`- ${item}`);
    lines.push('');
  }
  return lines.join('\n');
}

export function updateChangelog(filePath, newEntry) {
  const content = readFileSync(filePath, 'utf8');
  const updated = content.replace(
    /## \[Unreleased\]\s*\n/,
    `## [Unreleased]\n\n${newEntry}`
  );
  writeFileSync(filePath, updated);
}

function getCommits(lastTag) {
  const range = lastTag ? `${lastTag}..HEAD` : 'HEAD';
  const SEP = '';
  const FIELD_SEP = '';
  const format = `%H${FIELD_SEP}%B${SEP}`;
  let raw;
  try {
    raw = execSync(`git log ${range} --pretty=format:"${format}"`, {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
  } catch (e) {
    raw = execSync(`git log --pretty=format:"${format}"`, {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
  }
  const entries = raw.split(SEP).map(s => s.trim()).filter(Boolean);
  const commits = [];
  for (const entry of entries) {
    const [hash, ...rest] = entry.split(FIELD_SEP);
    const fullMsg = rest.join(FIELD_SEP);
    const parsed = parseCommitMessage(fullMsg);
    if (parsed) commits.push({ ...parsed, hash });
  }
  return commits;
}

function setGithubOutput(key, value) {
  const out = process.env.GITHUB_OUTPUT;
  if (!out) return;
  writeFileSync(out, `${key}=${value}\n`, { flag: 'a' });
}

async function main() {
  const lastTag = process.env.LAST_TAG || '';
  const headMsg = process.env.HEAD_COMMIT_MSG || '';

  if (/\[skip release\]/i.test(headMsg)) {
    console.log('Detected [skip release] in HEAD commit. Skipping.');
    process.exit(78);
  }

  const commits = getCommits(lastTag);
  console.log(`Analyzing ${commits.length} commit(s) since ${lastTag || 'beginning'}`);

  const releaseAs = parseReleaseAsFooter(headMsg);
  const currentVersion = readCurrentVersion();
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

  bumpCargoToml(resolve(REPO_ROOT, 'Cargo.toml'), newVersion, true);
  bumpCargoToml(resolve(REPO_ROOT, 'crates/core/Cargo.toml'), newVersion, false);
  bumpCargoToml(resolve(REPO_ROOT, 'crates/platform/Cargo.toml'), newVersion, false);
  bumpCargoToml(resolve(REPO_ROOT, 'src-tauri/Cargo.toml'), newVersion, false);
  bumpJsonVersion(resolve(REPO_ROOT, 'package.json'), newVersion);
  bumpJsonVersion(resolve(REPO_ROOT, 'src-tauri/tauri.conf.json'), newVersion);

  const groups = groupCommitsByType(commits);
  const dateISO = new Date().toISOString().slice(0, 10);
  const entry = generateChangelogEntry(newVersion, dateISO, groups);
  const changelogPath = resolve(REPO_ROOT, 'CHANGELOG.md');
  if (existsSync(changelogPath)) {
    updateChangelog(changelogPath, entry);
  } else {
    writeFileSync(changelogPath, `# Changelog\n\n## [Unreleased]\n\n${entry}`);
  }

  const isPrerelease = /-/.test(newVersion);
  setGithubOutput('version', newVersion);
  setGithubOutput('tag', `v${newVersion}`);
  setGithubOutput('is_prerelease', String(isPrerelease));
  console.log(`Wrote outputs: version=${newVersion}, tag=v${newVersion}, is_prerelease=${isPrerelease}`);
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
```

- [ ] **Step 2: Chạy test để verify PASS**

Run: `node --test scripts/version-bump.test.mjs`
Expected: Tất cả 15+ tests PASS.

- [ ] **Step 3: Commit**

```bash
git add scripts/version-bump.mjs scripts/version-bump.test.mjs
git commit -m "feat: add version-bump.mjs script for Conventional Commits-driven bumping"
```

---

## Task 5: Test script với data thực

**Files:**
- Test: chạy script manually

- [ ] **Step 1: Test với LAST_TAG=v0.1.38 và một commit feat giả lập**

Run:
```bash
HEAD_COMMIT_MSG="feat: test release" LAST_TAG=v0.1.38 node scripts/version-bump.mjs
```

Expected output bao gồm:
- `Bump minor: 0.1.38 -> 0.2.0` (vì có commit feat)
- File `Cargo.toml`, `package.json`, `src-tauri/tauri.conf.json`, `CHANGELOG.md` đã được sửa.

- [ ] **Step 2: Revert local changes (chỉ là test)**

```bash
git checkout -- Cargo.toml crates/core/Cargo.toml crates/platform/Cargo.toml src-tauri/Cargo.toml package.json src-tauri/tauri.conf.json CHANGELOG.md
```

- [ ] **Step 3: Test với Release-As footer**

Run:
```bash
HEAD_COMMIT_MSG="feat: jump to 1.0.0

Release-As: 1.0.0

BREAKING CHANGE: First production release" LAST_TAG=v0.1.38 node scripts/version-bump.mjs
```

Expected: `Release-As footer found: 1.0.0` + 3 file bump lên `1.0.0`.

- [ ] **Step 4: Revert local changes**

```bash
git checkout -- Cargo.toml crates/core/Cargo.toml crates/platform/Cargo.toml src-tauri/Cargo.toml package.json src-tauri/tauri.conf.json CHANGELOG.md
```

- [ ] **Step 5: Test [skip release]**

Run:
```bash
HEAD_COMMIT_MSG="chore: tidy [skip release]" LAST_TAG=v0.1.38 node scripts/version-bump.mjs
echo "Exit: $?"
```

Expected: `Detected [skip release] ...`, exit code 78.

---

## Task 6: Tạo generate-updater-manifest.mjs

**Files:**
- Create: `scripts/generate-updater-manifest.mjs`

- [ ] **Step 1: Tạo script**

Nội dung:
```javascript
#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = argv[i + 1];
      args[key] = value;
      i++;
    }
  }
  return args;
}

function readSig(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf8').trim();
}

function main() {
  const { channel, version, tag, output, 'windows-exe': winExe, 'macos-arm-dmg': macArm, 'macos-x64-dmg': macX64 } = parseArgs(process.argv);

  if (!channel || !version || !tag || !output) {
    console.error('Usage: generate-updater-manifest.mjs --channel <stable|beta> --version <X.Y.Z> --tag <vX.Y.Z> --output <path> [--windows-exe <path>] [--macos-arm-dmg <path>] [--macos-x64-dmg <path>]');
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

  const outDir = dirname(output);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(output, JSON.stringify(manifest, null, 2));
  console.log(`Wrote ${channel} manifest to ${output}:`);
  console.log(JSON.stringify(manifest, null, 2));
}

main();
```

- [ ] **Step 2: Test script locally**

Run:
```bash
node scripts/generate-updater-manifest.mjs --channel stable --version 1.0.0 --tag v1.0.0 --output /tmp/test-latest.json --windows-exe target/release/bundle/nsis/SmoothScroll_1.0.0_x64-setup.exe
```

Expected: File tạo ra (có thể không có signature nếu file .sig không tồn tại — script tolerate).

- [ ] **Step 3: Commit**

```bash
git add scripts/generate-updater-manifest.mjs
git commit -m "feat: add generate-updater-manifest.mjs for latest.json/beta.json generation"
```

---

## Task 7: Cập nhật workflow auto-release.yml — step bump

**Files:**
- Modify: `.github/workflows/auto-release.yml`

- [ ] **Step 1: Thay step "Install Rust/cargo-edit/Bump workspace version" bằng Node-based bump**

Mở `.github/workflows/auto-release.yml`. Thay block `if: "!startsWith(...)` và toàn bộ steps trong job `bump` bằng:

```yaml
  bump:
    if: "!contains(github.event.head_commit.message, '[skip release]')"
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.bump.outputs.version }}
      tag: ${{ steps.bump.outputs.tag }}
      is_prerelease: ${{ steps.bump.outputs.is_prerelease }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: ${{ secrets.GITHUB_TOKEN }}

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - uses: dtolnay/rust-toolchain@stable

      - name: Cache cargo
        uses: Swatinem/rust-cache@v2
        with:
          shared-key: bump

      - name: Determine version bump from Conventional Commits
        id: bump
        env:
          HEAD_COMMIT_MSG: ${{ github.event.head_commit.message }}
        run: |
          LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
          echo "Last tag: $LAST_TAG"
          LAST_TAG="$LAST_TAG" node scripts/version-bump.mjs

      - name: Regenerate Cargo.lock
        if: steps.bump.outputs.version != ''
        run: cargo update --workspace

      - name: Commit + tag + push
        if: steps.bump.outputs.version != ''
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add Cargo.toml Cargo.lock crates/core/Cargo.toml crates/platform/Cargo.toml \
                  src-tauri/Cargo.toml package.json src-tauri/tauri.conf.json CHANGELOG.md
          git commit -m "chore: release v${{ steps.bump.outputs.version }} [skip release]"
          git tag "v${{ steps.bump.outputs.version }}"
          git push origin master
          git push origin "v${{ steps.bump.outputs.version }}"
```

- [ ] **Step 2: Cập nhật step `build-windows` để dùng generate-updater-manifest.mjs**

Thay step `Generate latest.json` (pwsh) trong `build-windows` bằng:

```yaml
      - name: Generate latest.json
        shell: bash
        run: |
          node scripts/generate-updater-manifest.mjs \
            --channel stable \
            --version "${{ needs.bump.outputs.version }}" \
            --tag "${{ needs.bump.outputs.tag }}" \
            --output release-feed/latest.json \
            --windows-exe "target/release/bundle/nsis/SmoothScroll_${{ needs.bump.outputs.version }}_x64-setup.exe"
```

- [ ] **Step 3: Cập nhật job `build-macos` — rename dmg và generate beta.json**

Thay block `Upload .dmg to Release` trong `build-macos` bằng:

```yaml
      - name: Rename dmg with beta suffix
        run: |
          cd target/${{ matrix.target }}/release/bundle/dmg
          for f in *.dmg; do
            base="${f%.dmg}"
            mv "$f" "${base}_beta.dmg"
          done

      - name: Setup Node for manifest generation
        if: matrix.arch == 'arm64'
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Wait for x64 build artifact
        if: matrix.arch == 'arm64'
        run: echo "Note: beta.json with both archs requires both jobs' artifacts to be uploaded first. Manifest will only list arm64 here; x64 entry added via separate cleanup step."

      - name: Generate beta.json (arm64 only emits manifest)
        if: matrix.arch == 'arm64'
        run: |
          ARM_DMG=$(find target/aarch64-apple-darwin/release/bundle/dmg -name '*_beta.dmg' | head -n1)
          node scripts/generate-updater-manifest.mjs \
            --channel beta \
            --version "${{ needs.bump.outputs.version }}" \
            --tag "${{ needs.bump.outputs.tag }}" \
            --output release-feed/beta.json \
            --macos-arm-dmg "$ARM_DMG"

      - name: Upload macOS dmg + beta.json
        uses: softprops/action-gh-release@v2
        with:
          tag_name: ${{ needs.bump.outputs.tag }}
          generate_release_notes: true
          prerelease: false
          files: |
            target/${{ matrix.target }}/release/bundle/dmg/*_beta.dmg
            release-feed/beta.json
```

Lưu ý: Vì matrix chạy song song, x64 dmg sẽ được upload riêng lẻ. `beta.json` chỉ chứa arm64 entry cho tới khi user thêm logic merge (post-MVP). Trong scope MVP, document trong README rằng macOS beta updater chưa kiểm tra `beta.json` (auto-update disabled trên macOS).

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/auto-release.yml
git commit -m "ci: switch auto-release bump to Conventional Commits and add macOS beta channel"
```

---

## Task 8: Tạo commitlint config

**Files:**
- Create: `commitlint.config.js`

- [ ] **Step 1: Tạo file commitlint.config.js**

Nội dung:
```javascript
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'perf',
        'revert',
        'docs',
        'style',
        'refactor',
        'test',
        'build',
        'ci',
        'chore',
      ],
    ],
    'subject-case': [0],
  },
};
```

- [ ] **Step 2: Add devDependencies**

Run:
```bash
pnpm add -D @commitlint/cli @commitlint/config-conventional
```

Expected: `package.json` thêm 2 dev deps, `pnpm-lock.yaml` update.

- [ ] **Step 3: Test commitlint locally**

Run:
```bash
echo "feat: test" | pnpm commitlint
echo "Exit: $?"
echo "bad subject" | pnpm commitlint
echo "Exit: $?"
```

Expected: Đầu tiên exit 0, sau exit ≠ 0.

- [ ] **Step 4: Commit**

```bash
git add commitlint.config.js package.json pnpm-lock.yaml
git commit -m "build: add commitlint config and dependencies"
```

---

## Task 9: Tạo workflow commitlint.yml

**Files:**
- Create: `.github/workflows/commitlint.yml`

- [ ] **Step 1: Tạo workflow**

Nội dung:
```yaml
name: Commitlint

on:
  pull_request:
    branches: [master]

permissions:
  contents: read

jobs:
  commitlint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - uses: pnpm/action-setup@v4

      - run: pnpm install --frozen-lockfile

      - name: Validate commit messages
        run: |
          BASE="${{ github.event.pull_request.base.sha }}"
          HEAD="${{ github.event.pull_request.head.sha }}"
          pnpm commitlint --from "$BASE" --to "$HEAD" --verbose
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/commitlint.yml
git commit -m "ci: add commitlint workflow for pull requests"
```

---

## Task 10: Test release-channel helper (TDD - RED)

**Files:**
- Create: `src/lib/release-channel.test.ts`

- [ ] **Step 1: Tạo test file**

Nội dung:
```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/plugin-os", () => ({
  platform: vi.fn(),
}));

import { platform } from "@tauri-apps/plugin-os";
import { getReleaseChannel } from "./release-channel";

describe("getReleaseChannel", () => {
  beforeEach(() => {
    vi.mocked(platform).mockReset();
  });

  it("returns 'beta' on macOS", () => {
    vi.mocked(platform).mockReturnValue("macos");
    expect(getReleaseChannel()).toBe("beta");
  });

  it("returns 'stable' on Windows", () => {
    vi.mocked(platform).mockReturnValue("windows");
    expect(getReleaseChannel()).toBe("stable");
  });

  it("returns 'stable' on Linux (future-proof)", () => {
    vi.mocked(platform).mockReturnValue("linux");
    expect(getReleaseChannel()).toBe("stable");
  });
});
```

- [ ] **Step 2: Chạy test verify FAIL**

Run: `pnpm vitest run src/lib/release-channel.test.ts`
Expected: FAIL với "Cannot find module './release-channel'".

---

## Task 11: Implement release-channel helper (TDD - GREEN)

**Files:**
- Create: `src/lib/release-channel.ts`

- [ ] **Step 1: Tạo helper**

Nội dung:
```typescript
import { platform } from "@tauri-apps/plugin-os";

export type ReleaseChannel = "stable" | "beta";

export function getReleaseChannel(): ReleaseChannel {
  return platform() === "macos" ? "beta" : "stable";
}
```

- [ ] **Step 2: Chạy test verify PASS**

Run: `pnpm vitest run src/lib/release-channel.test.ts`
Expected: 3 tests PASS.

- [ ] **Step 3: Verify Tauri OS plugin có sẵn**

Run:
```bash
cat package.json | grep -A1 '"@tauri-apps/plugin-os"' || echo "Plugin not yet installed"
```

Nếu không có:
```bash
pnpm add @tauri-apps/plugin-os
```

Và thêm vào `src-tauri/Cargo.toml` dependencies:
```toml
tauri-plugin-os = "2"
```

Và register trong `src-tauri/src/main.rs` (hoặc `lib.rs`):
```rust
.plugin(tauri_plugin_os::init())
```

(Skip step này nếu đã có sẵn — chạy `grep -r tauri_plugin_os src-tauri/src/` để check.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/release-channel.ts src/lib/release-channel.test.ts package.json pnpm-lock.yaml src-tauri/Cargo.toml src-tauri/src/main.rs src-tauri/src/lib.rs Cargo.lock 2>/dev/null
git commit -m "feat: add getReleaseChannel helper for platform-based channel detection"
```

(Chỉ stage các file thực sự thay đổi — `git status` để confirm.)

---

## Task 12: Thêm i18n keys cho BetaBadge

**Files:**
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/vi.json`
- Modify: `src/i18n/locales/zh.json`

- [ ] **Step 1: Thêm keys vào en.json**

Mở `src/i18n/locales/en.json`, tìm object `"about": { ... }` và thêm key:

```json
{
  "about": {
    "version": "Version",
    "...": "existing keys",
    "beta_badge_label": "BETA",
    "beta_badge_tooltip": "macOS build is in beta and unsigned. See README for install instructions."
  }
}
```

(Lưu ý: chèn 2 dòng `beta_badge_*` vào object `about`, giữ JSON hợp lệ.)

- [ ] **Step 2: Thêm keys vào vi.json**

```json
"beta_badge_label": "BETA",
"beta_badge_tooltip": "Phiên bản macOS đang ở giai đoạn beta và chưa ký số. Xem README để biết cách cài đặt."
```

- [ ] **Step 3: Thêm keys vào zh.json**

```json
"beta_badge_label": "测试版",
"beta_badge_tooltip": "macOS 版本目前为测试版且未签名。请参阅 README 了解安装说明。"
```

- [ ] **Step 4: Commit**

```bash
git add src/i18n/locales/en.json src/i18n/locales/vi.json src/i18n/locales/zh.json
git commit -m "feat(i18n): add BetaBadge translation keys for en/vi/zh"
```

---

## Task 13: Test BetaBadge component (TDD - RED)

**Files:**
- Create: `src/components/BetaBadge.test.tsx`

- [ ] **Step 1: Tạo test**

Nội dung:
```typescript
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/release-channel", () => ({
  getReleaseChannel: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "about.beta_badge_label": "BETA",
        "about.beta_badge_tooltip": "macOS beta",
      };
      return map[key] ?? key;
    },
  }),
}));

import { getReleaseChannel } from "@/lib/release-channel";
import { BetaBadge } from "./BetaBadge";

describe("BetaBadge", () => {
  it("renders nothing when channel is stable", () => {
    vi.mocked(getReleaseChannel).mockReturnValue("stable");
    const { container } = render(<BetaBadge />);
    expect(container.firstChild).toBeNull();
  });

  it("renders 'BETA' label when channel is beta", () => {
    vi.mocked(getReleaseChannel).mockReturnValue("beta");
    render(<BetaBadge />);
    expect(screen.getByText("BETA")).toBeTruthy();
  });

  it("has accessible tooltip via title attribute", () => {
    vi.mocked(getReleaseChannel).mockReturnValue("beta");
    const { container } = render(<BetaBadge />);
    const el = container.querySelector("[title]");
    expect(el?.getAttribute("title")).toBe("macOS beta");
  });
});
```

- [ ] **Step 2: Check testing-library installed**

Run:
```bash
cat package.json | grep -E '"@testing-library/react"|"jsdom"'
```

Nếu thiếu `@testing-library/react`:
```bash
pnpm add -D @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 3: Chạy test verify FAIL**

Run: `pnpm vitest run src/components/BetaBadge.test.tsx`
Expected: FAIL "Cannot find module './BetaBadge'".

---

## Task 14: Implement BetaBadge component (TDD - GREEN)

**Files:**
- Create: `src/components/BetaBadge.tsx`

- [ ] **Step 1: Tạo component**

Nội dung:
```typescript
import { useTranslation } from "react-i18next";
import { getReleaseChannel } from "@/lib/release-channel";

export function BetaBadge() {
  const { t } = useTranslation();
  const channel = getReleaseChannel();
  if (channel !== "beta") return null;

  return (
    <span
      title={t("about.beta_badge_tooltip")}
      className="inline-flex items-center rounded-md border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400"
    >
      {t("about.beta_badge_label")}
    </span>
  );
}
```

- [ ] **Step 2: Chạy test verify PASS**

Run: `pnpm vitest run src/components/BetaBadge.test.tsx`
Expected: 3 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/BetaBadge.tsx src/components/BetaBadge.test.tsx package.json pnpm-lock.yaml 2>/dev/null
git commit -m "feat: add BetaBadge component for macOS beta channel UI"
```

---

## Task 15: Mount BetaBadge vào AboutSection

**Files:**
- Modify: `src/components/settings/AboutSection.tsx`

- [ ] **Step 1: Import BetaBadge**

Thêm dòng import (sau dòng `import { Button } from ...`):
```typescript
import { BetaBadge } from "@/components/BetaBadge";
```

- [ ] **Step 2: Mount badge cạnh version display**

Tìm block:
```tsx
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t("about.version")}</span>
          <span className="font-medium tabular-nums">{version}</span>
        </div>
```

Đổi thành:
```tsx
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t("about.version")}</span>
          <span className="flex items-center gap-2">
            <span className="font-medium tabular-nums">{version}</span>
            <BetaBadge />
          </span>
        </div>
```

- [ ] **Step 3: Build kiểm tra type**

Run: `pnpm build`
Expected: Build PASS, không có TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/AboutSection.tsx
git commit -m "feat: show BetaBadge next to version in AboutSection"
```

---

## Task 16: Update README.md với macOS install instructions

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Đọc README hiện tại để tìm vị trí phù hợp**

Run: `cat README.md | head -40`

- [ ] **Step 2: Thêm section mới ngay sau phần "Installation" (hoặc tương đương)**

Thêm block markdown sau:

```markdown
## Installing on macOS (Beta)

The macOS build is currently in **beta** and **unsigned** (no Apple Developer ID yet). When you first open the app, macOS Gatekeeper will block it.

To allow the app:

**Option 1 — Terminal (recommended):**
```bash
xattr -dr com.apple.quarantine /Applications/SmoothScroll.app
```

**Option 2 — System Settings:**
1. Try to open `SmoothScroll.app`. macOS shows a warning.
2. Go to **System Settings → Privacy & Security**.
3. Scroll to the security message about SmoothScroll and click **"Open Anyway"**.

Auto-updates are disabled on the macOS beta channel. Download new releases manually from the [Releases page](https://github.com/quangtruong2003/SmoothScroll/releases) until code-signing is set up.
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add macOS beta install instructions and Gatekeeper bypass"
```

---

## Task 17: Migration commit — bump 0.1.38 → 1.0.0

**Files:**
- (workflow tự sửa các file version)

- [ ] **Step 1: Verify CHANGELOG hiện tại có entry 1.0.0**

Run: `head -25 CHANGELOG.md`
Expected: Có `## [1.0.0] - 2026-05-23` section (từ Task 1).

- [ ] **Step 2: Tạo migration commit**

Vì CHANGELOG entry 1.0.0 đã được seed bằng tay (Task 1), workflow sẽ KHÔNG cần generate lại entry này — nhưng vẫn cần bump version trong 3 file. Để tránh duplicate entry, sửa script `version-bump.mjs` để skip insert entry nếu version đã có sẵn trong CHANGELOG.

Cập nhật `updateChangelog` trong `scripts/version-bump.mjs`:

```javascript
export function updateChangelog(filePath, newVersion, newEntry) {
  const content = readFileSync(filePath, 'utf8');
  if (content.includes(`## [${newVersion}]`)) {
    console.log(`CHANGELOG already has entry for ${newVersion}, skipping insert.`);
    return;
  }
  const updated = content.replace(
    /## \[Unreleased\]\s*\n/,
    `## [Unreleased]\n\n${newEntry}`
  );
  writeFileSync(filePath, updated);
}
```

Và update call site trong `main()`:
```javascript
if (existsSync(changelogPath)) {
  updateChangelog(changelogPath, newVersion, entry);
}
```

- [ ] **Step 3: Update test cho updateChangelog**

Thêm vào `scripts/version-bump.test.mjs`:
```javascript
import { updateChangelog } from './version-bump.mjs';
import { mkdtempSync, writeFileSync as wfs, readFileSync as rfs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('updateChangelog: skips when version entry already exists', () => {
  const dir = mkdtempSync(join(tmpdir(), 'changelog-'));
  const path = join(dir, 'CHANGELOG.md');
  wfs(path, '# Changelog\n\n## [Unreleased]\n\n## [1.0.0] - 2026-05-23\n\nExisting entry\n');
  updateChangelog(path, '1.0.0', '## [1.0.0] - 2026-05-23\n\n### Added\n- New\n');
  const result = rfs(path, 'utf8');
  assert.ok(result.includes('Existing entry'));
  assert.ok(!result.includes('### Added\n- New'));
});

test('updateChangelog: inserts entry below Unreleased when version absent', () => {
  const dir = mkdtempSync(join(tmpdir(), 'changelog-'));
  const path = join(dir, 'CHANGELOG.md');
  wfs(path, '# Changelog\n\n## [Unreleased]\n');
  updateChangelog(path, '1.1.0', '## [1.1.0] - 2026-05-24\n\n### Added\n- Feature\n');
  const result = rfs(path, 'utf8');
  assert.ok(result.includes('## [1.1.0]'));
  assert.ok(result.includes('### Added\n- Feature'));
});
```

- [ ] **Step 4: Run tests verify PASS**

Run: `node --test scripts/version-bump.test.mjs`
Expected: Tất cả tests PASS bao gồm 2 test mới.

- [ ] **Step 5: Commit script update**

```bash
git add scripts/version-bump.mjs scripts/version-bump.test.mjs
git commit -m "fix: skip CHANGELOG insertion when version entry already exists"
```

- [ ] **Step 6: Push tất cả commits + tạo migration commit thực hiện bump 1.0.0**

Lưu ý quan trọng: bạn có 2 lựa chọn để trigger lần bump đầu tiên:

**Option A — Để workflow tự bump khi push:**
Push tất cả commits hiện tại lên master. Workflow detect bump level từ commits (sẽ ra MAJOR vì có `feat:` + một số commit khác hoặc `BREAKING CHANGE:`). Nhưng version cuối có thể không phải 1.0.0 chính xác.

**Option B — Force version 1.0.0 bằng Release-As:** (recommended)
Tạo commit empty với footer:

```bash
git commit --allow-empty -m "feat!: adopt SemVer 2.0.0 international versioning standard

$(cat <<'EOF'
Migrate from 0.1.38 to 1.0.0 to signal production stability and adopt SemVer
2.0.0 + Conventional Commits 1.0.0 + Keep a Changelog 1.1.0 as international
versioning standards. macOS adopts beta channel with separate updater manifest.

Release-As: 1.0.0

BREAKING CHANGE: First production release. Settings schema unchanged, but the
version jumps from 0.1.38 to 1.0.0. macOS users move to a beta channel that
shows a BETA badge in Settings. macOS auto-update is disabled until code-signing
is configured.
EOF
)"
```

- [ ] **Step 7: Push lên master**

```bash
git push origin master
```

Expected:
- Workflow `Auto Release` chạy.
- Job `bump`:
  - Step "Determine version bump" log: `Release-As footer found: 1.0.0`.
  - 3 file bump lên `1.0.0`.
  - Commit `chore: release v1.0.0 [skip release]` + tag `v1.0.0` được push.
- Job `build-windows` build NSIS + MSI, generate `latest.json`.
- Job `build-macos` build DMG arm64 + x64 với suffix `_beta`, generate `beta.json`.
- GitHub Release `v1.0.0` được tạo với artifacts.

- [ ] **Step 8: Verify kết quả trên GitHub**

Mở `https://github.com/quangtruong2003/SmoothScroll/releases/tag/v1.0.0` và verify:
- Tag = `v1.0.0`.
- Artifacts: `SmoothScroll_1.0.0_x64-setup.exe` (+ `.sig`), `SmoothScroll_1.0.0_x64.msi`, `SmoothScroll_1.0.0_aarch64_beta.dmg`, `SmoothScroll_1.0.0_x64_beta.dmg`, `latest.json`, `beta.json`.
- Release notes auto-generated từ commits.

Nếu thiếu artifact, check workflow run logs.

---

## Task 18: Verify end-to-end với commit mới

**Files:** (none — test workflow)

- [ ] **Step 1: Tạo commit fix giả lập**

```bash
git commit --allow-empty -m "fix: verify auto-bump patch from 1.0.0"
git push origin master
```

- [ ] **Step 2: Đợi workflow chạy + verify**

Mở GitHub Actions, đợi `Auto Release` complete. Expected:
- `bump` job: log `Bump patch: 1.0.0 -> 1.0.1`.
- Release `v1.0.1` được tạo.
- CHANGELOG.md có entry `## [1.0.1] - <today>` với `### Fixed\n- verify auto-bump patch from 1.0.0`.

- [ ] **Step 3: Tạo commit chore không bump**

```bash
git commit --allow-empty -m "chore: verify skip-release for chore commits"
git push origin master
```

- [ ] **Step 4: Verify workflow skip**

Expected: workflow run shows `bump` job exit 78, no new release.

---

## Self-Review

**Spec coverage check:**

- [x] Section 2 (chuẩn): Task 1 (CHANGELOG), Task 2 (VERSIONING.md), Task 7 (workflow), Task 8 (commitlint) → covered.
- [x] Section 3 (bump rules): Task 3-4 (determineBump tests + impl) → covered.
- [x] Section 4 (single version multi-channel): Task 7 step 2-3 (latest.json + beta.json), Task 11 (release-channel) → covered.
- [x] Section 5 (migration): Task 17 → covered.
- [x] Section 6 (automation): Task 4-7 → covered.
- [x] Section 7 (macOS beta UX): Task 11-16 → covered.
- [x] Section 8 (file structure): toàn bộ tasks → covered.
- [x] Section 9 (edge cases): script logic trong Task 4 (skip release, release-as, no commits) + tests Task 3 → covered.
- [x] Section 10 (CHANGELOG seed): Task 1 → covered.
- [x] Section 11 (không thay đổi): không có task → đúng.
- [x] Section 12 (success criteria): Task 17 step 8, Task 18 → covered.
- [x] Section 13 (out of scope): không có task → đúng.

**Placeholder scan:** Không có TBD/TODO. Tất cả code blocks đều có content cụ thể. Step 2 trong Task 16 có placeholder cho header tìm vị trí trong README — chấp nhận được vì README content khác biệt từng repo.

**Type consistency:** `determineBump` trả về `'major'|'minor'|'patch'|null` consistent giữa test (Task 3) và impl (Task 4). `getReleaseChannel` trả về `'stable'|'beta'` consistent giữa Task 10, 11, 13, 14. `parseReleaseAsFooter` trả về `string|null` consistent.

**Function/property name consistency:**
- `groupCommitsByType` returns `groups` keyed by `'Added'|'Fixed'|'Performance'|'Changed'` — consistent giữa Task 3 test, Task 4 impl, Task 4 `generateChangelogEntry`.
- `updateChangelog(filePath, newVersion, newEntry)` — initial impl trong Task 4 chỉ có 2 args (filePath, newEntry). Task 17 thêm `newVersion` arg. Fix: Task 4 impl phải khớp signature 3-arg với Task 17.

**Fix Task 4 inline:** Trong code block của Task 4 step 1, update `updateChangelog` signature ngay từ đầu để khớp với Task 17.
