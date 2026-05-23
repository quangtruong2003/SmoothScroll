# International Versioning Standard for SmoothScroll

**Date:** 2026-05-23
**Status:** Draft, awaiting user review
**Owner:** quangtruong2003

## 1. Mục tiêu

Áp dụng bộ chuẩn version quốc tế cho SmoothScroll và tự động hóa toàn bộ quy trình bump version + release. Yêu cầu cốt lõi của user:

- Push code lên `master` là tự động bump version, tag, release, build artifact. Không thao tác thủ công.
- Windows: release stable bắt đầu từ `1.0.0`.
- macOS: release beta channel (vì chưa có Apple Developer ID, build unsigned).

## 2. Chuẩn áp dụng

| Chuẩn | Version | Vai trò |
|-------|---------|---------|
| [Semantic Versioning](https://semver.org/spec/v2.0.0.html) | 2.0.0 | Format version `MAJOR.MINOR.PATCH[-prerelease]` |
| [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) | 1.0.0 | Format commit message để auto-detect bump level |
| [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) | 1.1.0 | Format `CHANGELOG.md` |

Git tag format: `vMAJOR.MINOR.PATCH` (vd: `v1.0.0`, `v1.1.0-beta.1`).

## 3. Quy tắc bump (user-facing behavior)

| Bump | Khi nào | Trigger commit |
|------|---------|----------------|
| **MAJOR** | Settings/config schema không tương thích ngược (user mất config), drop OS support, redesign UX phá vỡ workflow user | Commit có footer `BREAKING CHANGE:` hoặc dạng `feat!:`, `fix!:` |
| **MINOR** | Thêm tính năng mới tương thích ngược (setting mới, theme mới, ngôn ngữ mới) | `feat:` |
| **PATCH** | Bug fix, perf, polish, security patch không đổi behavior | `fix:`, `perf:`, `revert:` |
| **No bump** | Refactor, docs, test, CI/build housekeeping | `refactor:`, `docs:`, `test:`, `chore:`, `ci:`, `build:`, `style:` |

**Pre-release:** Nếu commit có footer `Release-As: X.Y.Z-beta.N` (case-insensitive), version mới = giá trị đó.

**Override:** Nếu commit có `[skip release]` trong subject hoặc body, workflow bỏ qua bump.

## 4. Single version, multi-channel

SemVer cho phép 1 version/release. Windows và macOS chia channel chứ không chia version:

- **Codebase:** một version duy nhất ở 3 file (`package.json`, `src-tauri/tauri.conf.json`, `Cargo.toml` workspace).
- **Windows channel = stable.** Updater endpoint = `latest.json` (như hiện tại).
- **macOS channel = beta.** Updater endpoint = `beta.json` (mới). UI hiển thị badge "Beta" trên macOS.

Khi macOS đủ ổn định để promote stable, đổi runtime endpoint cho macOS sang `latest.json`. Không cần đổi version scheme.

## 5. Migration: `0.1.38` → `1.0.0`

User (không phải bot) tạo commit khởi tạo chuẩn mới bằng tay, push lên `master`. Commit có format:

```
feat!: adopt SemVer 2.0.0 + Conventional Commits as international versioning standard

Release-As: 1.0.0

BREAKING CHANGE: First production release. Settings schema unchanged but
version jumps from 0.1.38 to 1.0.0 to signal API/UX stability commitment.
```

Sau commit này:
- Workflow detect `Release-As: 1.0.0` → force bump version = `1.0.0`.
- CHANGELOG.md có entry `## [1.0.0] - YYYY-MM-DD` consolidate toàn bộ tính năng đã có.

## 6. Automation: nâng cấp workflow hiện có

**Không thay** `auto-release.yml` bằng semantic-release. Lý do: workflow hiện đã tự động (push → bump → build → release), chỉ cần thay logic "bump patch cứng" bằng "bump theo Conv Commits".

### 6.1 Script bump mới: `scripts/version-bump.mjs`

Node script (không cần dependency ngoài) làm những việc sau:

```
INPUT (env):
  GITHUB_OUTPUT — đường dẫn file output cho GitHub Actions
  LAST_TAG — tag cuối cùng (vd v1.0.5), nếu rỗng thì lấy tag mới nhất trong repo
  HEAD_COMMIT_MSG — message của commit HEAD (để check Release-As/skip release)

LOGIC:
  1. Đọc commits từ LAST_TAG..HEAD bằng `git log --pretty=...`.
  2. Nếu HEAD message chứa "[skip release]" → exit 78 (workflow neutral, skip release).
  3. Nếu HEAD body có "Release-As: X.Y.Z[-prerelease]" → newVersion = giá trị đó.
  4. Ngược lại:
     - Tìm `BREAKING CHANGE:` footer hoặc subject dạng `<type>!:` → bump = MAJOR.
     - Có commit `feat:` → bump = MINOR.
     - Có commit `fix:`, `perf:`, `revert:` → bump = PATCH.
     - Không có gì khớp → exit 78 (no release needed).
  5. Đọc currentVersion từ Cargo.toml workspace.package.version.
  6. Tính newVersion theo SemVer rules.
  7. Ghi 3 file:
     - Cargo.toml: replace `version = "X.Y.Z"` trong [workspace.package].
     - package.json: jq-style update `.version`.
     - src-tauri/tauri.conf.json: jq-style update `.version`.
  8. Generate CHANGELOG entry từ commits theo Keep a Changelog format.
     Group commits theo type: feat → Added, fix → Fixed, perf → Performance, etc.
     Update CHANGELOG.md: insert section mới ngay sau `## [Unreleased]`.
  9. Output cho workflow:
     - version=X.Y.Z
     - tag=vX.Y.Z
     - is_prerelease=true/false (true nếu version có `-` suffix)

OUTPUT:
  Files modified: Cargo.toml, crates/*/Cargo.toml, src-tauri/Cargo.toml,
  Cargo.lock (regenerate sau khi bump), package.json, src-tauri/tauri.conf.json,
  CHANGELOG.md.
```

Script này không phụ thuộc semantic-release/release-please. Chỉ Node 20 + `git` + `cargo` (đã có trong CI image).

### 6.2 Workflow `auto-release.yml` cập nhật

**Step `bump` đổi như sau:**

```yaml
- name: Determine version bump from Conventional Commits
  id: bump
  env:
    HEAD_COMMIT_MSG: ${{ github.event.head_commit.message }}
  run: |
    LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
    LAST_TAG="$LAST_TAG" node scripts/version-bump.mjs

- name: Regenerate Cargo.lock
  run: cargo update --workspace --offline || cargo update --workspace

- name: Commit + tag + push
  run: |
    git config user.name "github-actions[bot]"
    git config user.email "github-actions[bot]@users.noreply.github.com"
    git add Cargo.toml Cargo.lock crates/*/Cargo.toml src-tauri/Cargo.toml \
            package.json src-tauri/tauri.conf.json CHANGELOG.md
    git commit -m "chore: release v${{ steps.bump.outputs.version }} [skip release]"
    git tag "v${{ steps.bump.outputs.version }}"
    git push origin master
    git push origin "v${{ steps.bump.outputs.version }}"
```

**Loop guard:** Commit message của bot có `[skip release]` → workflow tự skip lần chạy do chính nó trigger.

**Filter cũ** (`if: !startsWith(... 'chore: bump version')`) thay bằng:
```yaml
if: "!contains(github.event.head_commit.message, '[skip release]')"
```

### 6.3 macOS beta artifact + manifest

**Step build macOS (cập nhật):**

```yaml
- name: Rename dmg with beta suffix
  run: |
    cd target/${{ matrix.target }}/release/bundle/dmg
    for f in *.dmg; do
      base="${f%.dmg}"
      mv "$f" "${base}_beta.dmg"
    done

- name: Generate beta.json for macOS
  if: matrix.arch == 'arm64'
  run: |
    # Generate beta.json with both arm64 + x64 macOS entries.
    # Run once (only for arm64 matrix) to avoid double-write.
    node scripts/generate-updater-manifest.mjs \
      --channel beta \
      --version "${{ needs.bump.outputs.version }}" \
      --tag "${{ needs.bump.outputs.tag }}" \
      --output release-feed/beta.json

- name: Upload macOS dmg + beta.json
  uses: softprops/action-gh-release@v2
  with:
    tag_name: ${{ needs.bump.outputs.tag }}
    files: |
      target/${{ matrix.target }}/release/bundle/dmg/*_beta.dmg
      release-feed/beta.json
```

`scripts/generate-updater-manifest.mjs` chạy trên runner, build JSON object có `platforms.darwin-x86_64` và `platforms.darwin-aarch64`, signature lấy từ file `.sig` (nếu Tauri tạo) hoặc rỗng (vì macOS unsigned).

### 6.4 Workflow `commitlint.yml` mới

Soft-enforce Conv Commits trên PR (không block, chỉ comment):

```yaml
name: Commitlint
on: [pull_request]
jobs:
  commitlint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: wagoid/commitlint-github-action@v6
        with:
          configFile: commitlint.config.js
          failOnWarnings: false
```

`commitlint.config.js`:
```js
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', [
      'feat', 'fix', 'perf', 'revert',
      'docs', 'style', 'refactor', 'test', 'build', 'ci', 'chore'
    ]],
  },
};
```

Husky local hook (optional, document trong CONTRIBUTING.md):
- `.husky/commit-msg`: chạy `pnpm commitlint --edit "$1"`.

## 7. macOS beta UX

### 7.1 Beta badge

File mới `src/lib/release-channel.ts`:
```ts
import { platform } from '@tauri-apps/plugin-os';

export type ReleaseChannel = 'stable' | 'beta';

export function getReleaseChannel(): ReleaseChannel {
  return platform() === 'macos' ? 'beta' : 'stable';
}
```

File mới `src/components/BetaBadge.tsx`:
- Hiển thị pill nhỏ "BETA" cạnh tên app trong title bar / Settings header / About dialog.
- Tooltip: "Phiên bản beta — vui lòng báo cáo lỗi tại issues."

Integrate vào:
- `src/routes/Settings.tsx` header (cạnh tên app).
- `src/components/settings/AboutSection.tsx` (cạnh version number).

### 7.2 First-run notice (macOS unsigned)

Vì chưa có Apple Developer ID, macOS build không signed. User mở app lần đầu thấy "App is damaged" hoặc Gatekeeper block.

**Giải pháp tối thiểu (không thêm dev cost):**
- README có section "Installing on macOS" hướng dẫn:
  ```
  Vì SmoothScroll cho macOS đang ở giai đoạn beta và chưa được Apple ký số,
  bạn cần chạy lệnh sau một lần sau khi cài:
    xattr -dr com.apple.quarantine /Applications/SmoothScroll.app
  Hoặc: System Settings → Privacy & Security → "Open Anyway".
  ```
- Trong `BetaBadge` tooltip: link tới README section.

Không cần in-app UI notice phức tạp — beta user có khả năng đọc README.

## 8. Cấu trúc file thay đổi

**File mới:**
- `CHANGELOG.md` — Keep a Changelog format, generate bởi script.
- `docs/VERSIONING.md` — tài liệu chuẩn cho contributor.
- `commitlint.config.js`
- `scripts/version-bump.mjs`
- `scripts/generate-updater-manifest.mjs` (refactor logic latest.json hiện đang inline trong workflow).
- `.github/workflows/commitlint.yml`
- `src/lib/release-channel.ts`
- `src/components/BetaBadge.tsx`
- `.husky/commit-msg` (optional, doc only).

**File sửa:**
- `.github/workflows/auto-release.yml`:
  - Step bump dùng `scripts/version-bump.mjs` thay vì `cargo set-version --bump patch`.
  - Step commit có `[skip release]` thay vì `chore: bump version`.
  - Filter `if:` đổi sang `[skip release]`.
  - Step macOS rename dmg `_beta` suffix.
  - Step macOS generate `beta.json`.
  - Step Windows tách `generate-updater-manifest.mjs` (vẫn output `latest.json`).
- `package.json` — thêm `@commitlint/cli`, `@commitlint/config-conventional`, `husky` vào devDependencies (nếu user muốn local hook).
- `README.md` — section macOS install.
- `src/routes/Settings.tsx` — mount `<BetaBadge />` nếu channel = beta.

**File xóa:** không có.

## 9. Edge cases

| Vấn đề | Giải pháp |
|--------|-----------|
| Push commit không có type khớp (vd: subject "wip") | Script exit 78 → workflow skip release. Document trong VERSIONING.md. |
| Bot commit trigger loop | `[skip release]` trong commit của bot + filter `if:` ở workflow level. |
| Force version cụ thể | Commit footer `Release-As: 1.5.0` hoặc `Release-As: 2.0.0-rc.1`. |
| Có commit BREAKING + feat + fix cùng push | Lấy bump cao nhất = MAJOR. |
| `cargo set-version` không có sẵn | Script tự dùng regex update Cargo.toml — không phụ thuộc `cargo-edit`. |
| Tag conflict (đã tồn tại) | Script check `git rev-parse vX.Y.Z` trước, exit 1 nếu exists. |
| Cargo.lock cần update | `cargo update --workspace` sau khi bump. |
| Pre-release từ stable (vd 1.0.0 → 1.1.0-beta.1) | Chỉ qua `Release-As:` footer. Conv Commits không tự detect pre-release. |
| macOS dmg unsigned không qua được updater verify | Tauri updater check `.sig`. Nếu Tauri build không tạo `.sig` cho macOS unsigned → tạm thời tắt updater cho macOS (UI hiện notice "Auto-update không khả dụng trên macOS beta"). |

## 10. CHANGELOG seed cho v1.0.0

Section khởi tạo trong CHANGELOG:

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
- Settings UI with themes, i18n (en, vi, zh).
- Auto-updater integration (Windows).
- UIA-based text input detection on Windows.
- Tray panel + main window UX.

### Changed
- Version jumps from 0.1.38 → 1.0.0 to signal stability.
- Automated release workflow now derives bump level from Conventional Commits.

### Known Issues
- macOS builds unsigned (no Apple Developer ID yet). Users must allow via Gatekeeper.
- macOS auto-update disabled in beta channel.
```

## 11. Không thay đổi

- Tauri updater plugin (chỉ thêm endpoint `beta.json`, không đổi cấu trúc).
- Build profiles trong Cargo.toml.
- i18n, settings logic, scroll engine.
- File structure ứng dụng.

## 12. Success criteria

Sau khi implement:

1. [ ] Push commit `feat: add X` → tự động bump MINOR + tag + Release + build artifact.
2. [ ] Push commit `fix: Y` → tự động bump PATCH.
3. [ ] Push commit có `BREAKING CHANGE:` footer → tự động bump MAJOR.
4. [ ] Push commit `docs: Z` → không tạo release.
5. [ ] CHANGELOG.md tự update mỗi release với entries gom theo type.
6. [ ] Windows artifact tên `SmoothScroll_X.Y.Z_x64-setup.exe`, macOS artifact tên `SmoothScroll_X.Y.Z_macos_<arch>_beta.dmg`.
7. [ ] `latest.json` chỉ có Windows entry. `beta.json` được generate (chứa macOS entries, có thể không có signature do unsigned) nhưng macOS auto-update tạm tắt cho đến khi có Apple Developer ID — UI hiển thị "Auto-update không khả dụng trên macOS beta".
8. [ ] UI hiển thị badge "BETA" khi chạy trên macOS.
9. [ ] README có section "Installing on macOS" với lệnh xattr.
10. [ ] First push commit migration → version repo = `1.0.0`, git tag `v1.0.0`, GitHub Release `v1.0.0`.

## 13. Out of scope

- Apple Developer ID code signing (cần $99/năm + cấu hình notarization). Sẽ revisit khi user mua.
- Auto-update cho macOS beta (cần signing). Tắt tạm, hiện notice trong UI.
- Multiple stable channels (LTS, current). Chỉ 2 channel.
- Release notes thủ công đẹp hơn. Để release-notes-generator pattern tự nhiên (group by type).
- Migrate commit history cũ về Conv Commits format (không cần thiết).
