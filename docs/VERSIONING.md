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
