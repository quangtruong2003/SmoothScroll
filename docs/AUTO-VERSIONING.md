# Auto-Versioning System — Template

> **Template Version:** 1.0.0  
> **Last Updated:** 2026-06-20  
> **Purpose:** Copy và customize cho bất kỳ dự án nào

---

## Mục lục

1. [Overview](#1-overview)
2. [Standards](#2-standards)
3. [Quick Start](#3-quick-start)
4. [System Architecture](#4-system-architecture)
5. [Workflow Configuration](#5-workflow-configuration)
6. [Version Bump Script](#6-version-bump-script)
7. [Commit Convention](#7-commit-convention)
8. [File Structure](#8-file-structure)
9. [Customization Checklist](#9-customization-checklist)
10. [Examples](#10-examples)

---

## 1. Overview

### What It Does

Auto-versioning system tự động:
1. Phân tích commits kể từ lần release cuối
2. Tính version tiếp theo theo Semantic Versioning
3. Cập nhật tất cả file chứa version
4. Tạo commit và tag mới
5. Trigger build và release

### How It Works

```
┌────────────┐    push     ┌─────────────────┐    tag push    ┌─────────────────┐
│   DEV      │ ─────────► │  GitHub Actions  │ ─────────────► │  Build Jobs     │
│            │            │   (bump job)     │               │  (build,release)│
└────────────┘            └─────────────────┘               └─────────────────┘
                                  │
                                  │ outputs version
                                  ▼
                         ┌─────────────────┐
                         │ Update version  │
                         │ files + tag     │
                         └─────────────────┘
```

### Requirements

- **Git repository** trên GitHub
- **GitHub Actions** enabled
- **Node.js 18+** (cho scripts)
- **Git tags** setup (initial tag: `git tag v0.1.0`)

---

## 2. Standards

### Semantic Versioning 2.0.0

Format: `MAJOR.MINOR.PATCH[-prerelease]`

| Component | Tăng khi | Ví dụ |
|-----------|----------|-------|
| MAJOR | Breaking changes | `1.0.0` → `2.0.0` |
| MINOR | Features mới (backward compatible) | `1.0.0` → `1.1.0` |
| PATCH | Bug fixes (backward compatible) | `1.0.0` → `1.0.1` |
| Prerelease | Pre-release versions | `2.0.0-beta.1` |

### Conventional Commits 1.0.0

Format: `<type>(<scope>)?(!)?: <description>`

| Type | Mô tả | Bump |
|------|--------|------|
| `feat` | Feature mới | MINOR |
| `fix` | Bug fix | PATCH |
| `perf` | Performance | PATCH |
| `revert` | Revert commit | PATCH |
| `feat!`, `fix!`, hoặc `BREAKING CHANGE:` | Breaking change | MAJOR |
| `docs`, `chore`, `ci`, `test`, `refactor`, `style`, `build` | Không trigger release | - |

### Keep a Changelog 1.1.0

Format cho `CHANGELOG.md`:

```markdown
## [Unreleased]

## [1.0.0] - 2026-06-20

### Added
- feature mới

### Fixed
- bug đã fix
```

---

## 3. Quick Start

### 3.1 Initial Setup

```bash
# 1. Clone repo hoặc cd vào repo có sẵn
cd your-project

# 2. Tạo initial tag (đánh dấu starting point)
git tag v0.1.0

# 3. Push tag
git push origin v0.1.0
```

### 3.2 Copy Files

```bash
# Tạo cấu trúc thư mục
mkdir -p .github/workflows scripts

# Copy các file template:
# - .github/workflows/auto-release.yml
# - scripts/version-bump.mjs
# - scripts/version-bump.test.mjs (optional, cho testing)
```

### 3.3 Customize

Xem [Section 9: Customization Checklist](#9-customization-checklist)

### 3.4 Initial Commit

```bash
git add .
git commit -m "chore: setup auto-versioning

Release-As: 0.1.0"
git push origin master
```

---

## 4. System Architecture

### 4.1 Component Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           GITHUB ACTIONS                              │
│                                                                      │
│  ┌─────────┐     ┌──────────────┐     ┌─────────────────────┐      │
│  │  Guard  │────►│    Bump      │────►│    Build Jobs       │      │
│  │  Job    │     │    Job       │     │  (Windows/macOS/etc)│      │
│  └─────────┘     └──────┬───────┘     └─────────────────────┘      │
│                          │                                          │
│                          │ commit + tag + push                       │
│                          ▼                                          │
│                   ┌──────────────┐                                  │
│                   │   Git Repo   │                                  │
│                   │ (version bump)│                                  │
│                   └──────────────┘                                  │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 Files Overview

| File | Location | Purpose |
|------|----------|---------|
| `auto-release.yml` | `.github/workflows/` | GitHub Actions workflow |
| `version-bump.mjs` | `scripts/` | Core version bump logic |
| `version-bump.test.mjs` | `scripts/` | Unit tests |
| `CHANGELOG.md` | project root | Changelog (optional) |

### 4.3 Workflow Flow

```
1. Push to master branch
       │
       ▼
2. Guard job: Skip if tag push or [skip release]
       │
       ▼
3. Bump job:
   a. Get last tag
   b. Parse commits since last tag
   c. Determine bump level (major/minor/patch)
   d. Compute new version
   e. Update version files
   f. Update CHANGELOG.md
   g. Commit + tag + push
       │
       │ (re-triggered by tag push)
       ▼
4. Guard job: Skip (prevents infinite loop)
       │
       ▼
5. Build jobs: Build + upload artifacts
       │
       ▼
6. Release: GitHub Release created
```

---

## 5. Workflow Configuration

### 5.1 auto-release.yml

```yaml
name: Auto Release

on:
  push:
    branches: [master]
    paths:
      # === CUSTOMIZE: Thay đổi paths phù hợp ===
      - 'src/**'                    # Source code
      - 'lib/**'                    # Library code
      - 'package.json'              # Dependencies
      - 'Cargo.toml'                # Rust projects
      # Thêm các paths khác nếu cần
      # - 'scripts/**'
      # - '.github/workflows/auto-release.yml'

  workflow_dispatch:                # Manual trigger

permissions:
  contents: write

jobs:
  # === GUARD JOB: Ngăn infinite loop ===
  _guard:
    if: |
      !(
        github.event_name == 'push' &&
        (
          startsWith(github.ref, 'refs/tags/v') ||
          contains(github.event.head_commit.message, '[skip release]')
        )
      )
    runs-on: ubuntu-latest
    steps:
      - run: 'echo "Guarded: not a re-triggered run"'

  # === BUMP JOB: Tính version và update files ===
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

      # === CUSTOMIZE: Setup Node.js nếu dùng Node scripts ===
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      # === CORE BUMP LOGIC ===
      - name: Bump version
        id: bump
        run: |
          set +e
          LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
          HEAD_COMMIT_MSG=$(git log -1 --pretty=%B)
          echo "Last tag: $LAST_TAG"

          LAST_TAG="$LAST_TAG" HEAD_COMMIT_MSG="$HEAD_COMMIT_MSG" node scripts/version-bump.mjs
          EXIT_CODE=$?

          if [ $EXIT_CODE -eq 78 ]; then
            echo "skipped=true" >> "$GITHUB_OUTPUT"
            echo "No release triggered."
            exit 0
          elif [ $EXIT_CODE -ne 0 ]; then
            echo "version-bump.mjs failed with exit $EXIT_CODE"
            exit $EXIT_CODE
          fi

          echo "skipped=false" >> "$GITHUB_OUTPUT"

      # === CUSTOMIZE: Update dependencies nếu cần ===
      # - name: Update dependencies
      #   run: npm ci || yarn install

      # === COMMIT + TAG + PUSH ===
      - name: Commit + tag + push
        if: steps.bump.outputs.skipped != 'true'
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          
          # === CUSTOMIZE: Thay đổi files cần add ===
          git add Cargo.toml package.json src-tauri/Cargo.toml CHANGELOG.md
          git commit -m "chore: release v${{ steps.bump.outputs.version }} [skip release]"
          git tag "v${{ steps.bump.outputs.version }}"
          git push origin master
          git push origin "v${{ steps.bump.outputs.version }}"

  # === CUSTOMIZE: Build job cho platform của bạn ===
  build:
    needs: bump
    if: needs.bump.outputs.skipped != 'true'
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ needs.bump.outputs.tag }}

      # === CUSTOMIZE: Thêm steps build của bạn ===
      # - name: Setup
      # - name: Build
      # - name: Upload artifacts

      # === UPLOAD TO RELEASE ===
      - name: Upload to Release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: ${{ needs.bump.outputs.tag }}
          generate_release_notes: true
          # === CUSTOMIZE: Files cần upload ===
          files: |
            dist/*.exe
            dist/*.msi
```

---

## 6. Version Bump Script

### 6.1 version-bump.mjs (Full Template)

```javascript
#!/usr/bin/env node
/**
 * Auto Version Bump Script
 * 
 * Template cho auto-versioning system.
 * Customize các phần được đánh dấu === CUSTOMIZE ===
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

// === CUSTOMIZE: Định nghĩa bump level ===
const BUMP_LEVEL = { major: 3, minor: 2, patch: 1 };

// === CUSTOMIZE: Map commit type -> changelog section ===
const TYPE_TO_SECTION = {
  feat: 'Added',
  fix: 'Fixed',
  perf: 'Performance',
  revert: 'Changed',
};

// === CUSTOMIZE: Commit types trigger release ===
const RELEASE_TYPES = ['feat', 'fix', 'perf', 'revert'];

// === CUSTOMIZE: Breaking change types ===
const BREAKING_TYPES = ['feat', 'fix'];  // Types có thể là breaking

// ============================================================

export function determineBump(commits) {
  let highest = null;
  for (const c of commits) {
    let level = null;
    
    if (c.breaking) {
      level = 'major';
    } else if (c.type === 'feat') {
      level = 'minor';
    } else if (RELEASE_TYPES.includes(c.type)) {
      level = 'patch';
    }

    if (level && (highest === null || BUMP_LEVEL[level] > BUMP_LEVEL[highest])) {
      highest = level;
    }
  }
  return highest;
}

export function computeNewVersion(currentVersion, bump) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-.+)?$/.exec(currentVersion);
  if (!match) throw new Error(`Invalid version: ${currentVersion}`);
  
  let [, major, minor, patch] = match;
  major = Number(major);
  minor = Number(minor);
  patch = Number(patch);
  
  if (bump === 'major') return `${major + 1}.0.0`;
  if (bump === 'minor') return `${major}.${minor + 1}.0`;
  if (bump === 'patch') return `${major}.${minor}.${patch + 1}`;
  throw new Error(`Unknown bump: ${bump}`);
}

export function parseReleaseAsFooter(body) {
  const match = /^release-as:\s*(\S+)\s*$/im.exec(body);
  return match ? match[1] : null;
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

// === CUSTOMIZE: Đọc version từ file chính ===
export function readCurrentVersion() {
  // === Thay đổi: Đọc từ file chứa version của bạn ===
  const cargoToml = readFileSync(resolve(REPO_ROOT, 'Cargo.toml'), 'utf8');
  const match = /^\[workspace\.package\][\s\S]*?^version\s*=\s*"([^"]+)"/m.exec(cargoToml);
  if (!match) throw new Error('Cannot find version in Cargo.toml');
  return match[1];
  
  // Ví dụ cho package.json:
  // const pkg = JSON.parse(readFileSync(resolve(REPO_ROOT, 'package.json'), 'utf8'));
  // return pkg.version;
  
  // Ví dụ cho custom file:
  // const content = readFileSync(resolve(REPO_ROOT, 'VERSION'), 'utf8');
  // return content.trim();
}

// === CUSTOMIZE: Update version trong các files ===
export function bumpVersion(filePath, newVersion, content) {
  // Implement tùy theo file format
  // Thay đổi regex pattern cho phù hợp
  return content;
}

function updateAllVersionFiles(newVersion) {
  // === CUSTOMIZE: List files cần update version ===
  
  // Ví dụ cho Cargo.toml:
  const files = [
    'Cargo.toml',
    'package.json',
    // Thêm các file khác
  ];
  
  for (const file of files) {
    const path = resolve(REPO_ROOT, file);
    if (!existsSync(path)) continue;
    
    const content = readFileSync(path, 'utf8');
    let updated;
    
    if (file.endsWith('.toml')) {
      updated = content.replace(
        /(\[workspace\.package\][\s\S]*?\n)version\s*=\s*"[^"]+"/,
        `$1version = "${newVersion}"`
      );
    } else if (file.endsWith('.json')) {
      updated = content.replace(
        /^(\s*)"version":\s*"[^"]+"/m,
        `$1"version": "${newVersion}"`
      );
    }
    
    if (updated && updated !== content) {
      writeFileSync(path, updated);
      console.log(`Updated ${file} to ${newVersion}`);
    }
  }
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

export function updateChangelog(filePath, newVersion, newEntry) {
  const content = readFileSync(filePath, 'utf8');
  if (content.includes(`## [${newVersion}]`)) {
    console.log(`CHANGELOG already has entry for ${newVersion}`);
    return;
  }
  const updated = content.replace(
    /## \[Unreleased\]\s*\n/,
    `## [Unreleased]\n\n${newEntry}`
  );
  writeFileSync(filePath, updated);
}

function getCommits(lastTag) {
  const SEP = '<<<COMMIT_END>>>';
  const FIELD_SEP = '<<<FIELD>>>';
  const format = `%H${FIELD_SEP}%B${SEP}`;
  const args = ['log', `--pretty=format:${format}`];
  if (lastTag) args.splice(1, 0, `${lastTag}..HEAD`);
  
  let raw;
  try {
    raw = execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' });
  } catch {
    raw = execFileSync('git', ['log', `--pretty=format:${format}`], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
  }
  
  const entries = raw.split(SEP).map((s) => s.trim()).filter(Boolean);
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
    console.log('Detected [skip release]. Skipping.');
    process.exit(78);
  }

  const commits = getCommits(lastTag);
  console.log(`Analyzing ${commits.length} commit(s)`);

  const releaseAs = parseReleaseAsFooter(headMsg);
  const currentVersion = readCurrentVersion();
  let newVersion;

  if (releaseAs) {
    console.log(`Release-As: ${releaseAs}`);
    newVersion = releaseAs;
  } else {
    const bump = determineBump(commits);
    if (!bump) {
      console.log('No commits trigger release. Skipping.');
      process.exit(78);
    }
    newVersion = computeNewVersion(currentVersion, bump);
    console.log(`Bump ${bump}: ${currentVersion} -> ${newVersion}`);
  }

  updateAllVersionFiles(newVersion);

  // === Optional: Update CHANGELOG ===
  // const groups = groupCommitsByType(commits);
  // const dateISO = new Date().toISOString().slice(0, 10);
  // const entry = generateChangelogEntry(newVersion, dateISO, groups);
  // const changelogPath = resolve(REPO_ROOT, 'CHANGELOG.md');
  // if (existsSync(changelogPath)) updateChangelog(changelogPath, newVersion, entry);

  const isPrerelease = /-/.test(newVersion);
  setGithubOutput('version', newVersion);
  setGithubOutput('tag', `v${newVersion}`);
  setGithubOutput('is_prerelease', String(isPrerelease));
  console.log(`Done: version=${newVersion}, tag=v${newVersion}`);
}

const invokedFromCli = process.argv[1] && resolve(process.argv[1]) === resolve(__filename);
if (invokedFromCli) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
```

### 6.2 version-bump.test.mjs (Template)

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  determineBump,
  computeNewVersion,
  parseReleaseAsFooter,
  parseCommitMessage,
} from './version-bump.mjs';

// === Tests ===

test('determineBump: returns "major" for breaking changes', () => {
  const commits = [{ type: 'feat', breaking: true }];
  assert.equal(determineBump(commits), 'major');
});

test('determineBump: returns "minor" for feat', () => {
  const commits = [{ type: 'feat', breaking: false }];
  assert.equal(determineBump(commits), 'minor');
});

test('determineBump: returns "patch" for fix', () => {
  const commits = [{ type: 'fix', breaking: false }];
  assert.equal(determineBump(commits), 'patch');
});

test('determineBump: returns null for non-release types', () => {
  const commits = [
    { type: 'docs', breaking: false },
    { type: 'chore', breaking: false },
  ];
  assert.equal(determineBump(commits), null);
});

test('computeNewVersion: bumps patch', () => {
  assert.equal(computeNewVersion('1.0.0', 'patch'), '1.0.1');
});

test('computeNewVersion: bumps minor', () => {
  assert.equal(computeNewVersion('1.0.0', 'minor'), '1.1.0');
});

test('computeNewVersion: bumps major', () => {
  assert.equal(computeNewVersion('1.0.0', 'major'), '2.0.0');
});

test('parseReleaseAsFooter: extracts version', () => {
  const body = 'Message\n\nRelease-As: 2.0.0';
  assert.equal(parseReleaseAsFooter(body), '2.0.0');
});

test('parseCommitMessage: parses feat', () => {
  const parsed = parseCommitMessage('feat: add feature');
  assert.equal(parsed.type, 'feat');
  assert.equal(parsed.subject, 'add feature');
  assert.equal(parsed.breaking, false);
});

test('parseCommitMessage: detects bang', () => {
  const parsed = parseCommitMessage('feat!: breaking');
  assert.equal(parsed.breaking, true);
});
```

---

## 7. Commit Convention

### 7.1 Format

```
<type>(<scope>)?(!)?: <description>

[optional body]

[optional footer]
```

### 7.2 Types Reference

| Type | Mô tả | Bump | Ví dụ |
|------|--------|------|--------|
| `feat` | Feature mới | MINOR | `feat: add user login` |
| `fix` | Bug fix | PATCH | `fix: login button crash` |
| `perf` | Performance | PATCH | `perf: faster load time` |
| `revert` | Revert | PATCH | `revert: undo feature X` |
| `docs` | Documentation | - | `docs: update README` |
| `style` | Formatting | - | `style: format code` |
| `refactor` | Refactoring | - | `refactor: extract utils` |
| `test` | Tests | - | `test: add login tests` |
| `chore` | Maintenance | - | `chore: update deps` |
| `ci` | CI/CD | - | `ci: add lint job` |
| `build` | Build | - | `build: update webpack` |

### 7.3 Breaking Changes

**Method 1: Bang**
```
feat!: remove legacy API
```

**Method 2: Footer**
```
feat: change auth format

BREAKING CHANGE: Token format changed from v1 to v2.
```

### 7.4 Examples

```bash
# Good commits
git commit -m "feat: add dark mode"
git commit -m "fix: prevent crash on empty list"
git commit -m "perf: optimize database queries"
git commit -m "fix: change API response format

BREAKING CHANGE: Response structure changed."

# Bad commits (won't trigger release)
git commit -m "update readme"
git commit -m "fix typo"
git commit -m "bump dependencies"
```

---

## 8. File Structure

### 8.1 Minimal Setup

```
project/
├── .github/
│   └── workflows/
│       └── auto-release.yml    # Copy từ template
├── scripts/
│   └── version-bump.mjs        # Copy từ template
├── package.json                # Hoặc file chứa version
├── Cargo.toml                  # Cho Rust projects
└── CHANGELOG.md                # Optional
```

### 8.2 Common Version File Locations

| Project Type | Version File |
|-------------|--------------|
| Node.js | `package.json` |
| Rust | `Cargo.toml` (workspace.package.version) |
| Python | `pyproject.toml` hoặc `__version__` |
| Go | `version.go` hoặc `VERSION` file |
| Ruby | `version.rb` hoặc `*.gemspec` |
| PHP | `composer.json` |
| .NET | `*.csproj` |

---

## 9. Customization Checklist

### 9.1 Workflow File

- [ ] **Trigger paths**: Thay đổi paths trong `on.push.paths`
- [ ] **Build steps**: Thêm steps build của bạn
- [ ] **Upload files**: Thay đổi artifacts cần upload
- [ ] **Runtime**: Thay đổi `runs-on` nếu cần

### 9.2 Version Bump Script

- [ ] **Version source**: Đổi `readCurrentVersion()` để đọc từ file của bạn
- [ ] **Version update**: Đổi logic update files trong `updateAllVersionFiles()`
- [ ] **Commit types**: Điều chỉnh `RELEASE_TYPES` và `BREAKING_TYPES`
- [ ] **Changelog sections**: Thay đổi `TYPE_TO_SECTION` mapping

### 9.3 Example Customizations

#### Python Project

```javascript
export function readCurrentVersion() {
  // Đọc từ pyproject.toml
  const content = readFileSync(resolve(REPO_ROOT, 'pyproject.toml'), 'utf8');
  const match = /^version\s*=\s*"([^"]+)"/m.exec(content);
  return match[1];
}

export function updateVersion(filePath, newVersion, content) {
  return content.replace(/^version\s*=\s*"[^"]+"/m, `version = "${newVersion}"`);
}
```

#### Go Project

```javascript
export function readCurrentVersion() {
  // Đọc từ version.go
  const content = readFileSync(resolve(REPO_ROOT, 'version.go'), 'utf8');
  const match = /const\s+Version\s*=\s*"([^"]+)"/.exec(content);
  return match[1];
}
```

---

## 10. Examples

### 10.1 Simple Node.js Project

**File: package.json**
```json
{
  "name": "my-package",
  "version": "1.0.0",
  "scripts": {
    "build": "tsc"
  }
}
```

**File: version-bump.mjs (simplified)**
```javascript
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function readCurrentVersion() {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  return pkg.version;
}

export function updateVersion(newVersion) {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  pkg.version = newVersion;
  writeFileSync('package.json', JSON.stringify(pkg, null, 2));
}
```

### 10.2 Rust Project

**File: Cargo.toml**
```toml
[package]
name = "my-crate"
version = "1.0.0"

[workspace]
members = ["crate-a", "crate-b"]
```

**File: version-bump.mjs**
```javascript
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function readCurrentVersion() {
  const content = readFileSync('Cargo.toml', 'utf8');
  const match = /^\[package\][\s\S]*?^version\s*=\s*"([^"]+)"/m.exec(content);
  return match[1];
}

export function updateVersion(newVersion) {
  // Update workspace Cargo.toml
  let content = readFileSync('Cargo.toml', 'utf8');
  content = content.replace(/^version\s*=\s*"[^"]+"/m, `version = "${newVersion}"`);
  writeFileSync('Cargo.toml', content);
  
  // Update workspace members
  ['crate-a/Cargo.toml', 'crate-b/Cargo.toml'].forEach(file => {
    let c = readFileSync(file, 'utf8');
    c = c.replace(/^version\s*=\s*"[^"]+"/m, `version = "${newVersion}"`);
    writeFileSync(file, c);
  });
}
```

### 10.3 Multi-Platform Project

```yaml
jobs:
  build-windows:
    needs: bump
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ needs.bump.outputs.tag }}
      - name: Build
        run: npm run build
      - name: Upload
        uses: softprops/action-gh-release@v2
        with:
          files: dist/*.exe

  build-macos:
    needs: bump
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ needs.bump.outputs.tag }}
      - name: Build
        run: npm run build
      - name: Upload
        uses: softprops/action-gh-release@v2
        with:
          files: dist/*.zip

  build-linux:
    needs: bump
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ needs.bump.outputs.tag }}
      - name: Build
        run: npm run build
      - name: Upload
        uses: softprops/action-gh-release@v2
        with:
          files: dist/*.AppImage
```

---

## Appendix A: Exit Codes

| Code | Meaning | Action |
|------|---------|--------|
| `0` | Success | Continue to build |
| `78` | Skip (no release) | Skip all downstream jobs |
| `1` | Error | Fail workflow |

## Appendix B: Environment Variables

| Variable | Description |
|----------|-------------|
| `LAST_TAG` | Last git tag (set by workflow) |
| `HEAD_COMMIT_MSG` | Current commit message |
| `GITHUB_OUTPUT` | Output file for workflow |

## Appendix C: GitHub Secrets

| Secret | Required | Description |
|--------|----------|-------------|
| `GITHUB_TOKEN` | Auto | Provided by GitHub |
| Custom secrets | Varies | E.g., code signing keys |

---

*Template version 1.0.0 — Copy and customize for your project!*
