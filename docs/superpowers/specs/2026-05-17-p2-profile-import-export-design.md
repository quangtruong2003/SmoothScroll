# SmoothScroll P2 — Profile Import / Export + Share Spec

**Date:** 2026-05-17
**Status:** Draft, awaiting user review
**Target:** Windows .exe build first; macOS works (file dialogs cross-platform)
**Effort:** S (1-3 days)

## 1. Goal

Cho phép user export/import scroll profiles dưới dạng:
1. **JSON file** qua system file picker — backup hoặc transfer giữa máy.
2. **Compact share string** (`ssp_...`) — copy-paste qua chat, Reddit, Discord; dễ chia sẻ preset.

Tạo viral loop OSS: Reddit r/windows / r/MouseReview chia sẻ preset.

## 2. Architecture

```
┌──────────────────────────────────────────────────────────┐
│  React UI (src/)                                         │
│  - components/settings/ProfilesSection.tsx     [EDIT]    │
│      thêm toolbar: [Import] [Export selected]            │
│  - components/settings/ProfileShareDialog.tsx  [NEW]     │
│      Modal: textarea readonly với share string +         │
│      copy button                                          │
│  - components/settings/ProfileImportDialog.tsx [NEW]     │
│      Modal: textarea cho user paste, preview profile     │
│      trước khi confirm import                            │
│  - lib/profile-share.ts                        [NEW]     │
│      encode/decode wrappers qua IPC                      │
├──────────────────────────────────────────────────────────┤
│  Tauri commands (src-tauri/src/commands.rs)              │
│  - export_profile_share(profile_id) → String   [NEW]     │
│  - import_profile_share(share: String) →                 │
│      Result<ScrollProfile, String>             [NEW]     │
│  - export_profile_file(profile_id, path) →               │
│      Result<(), String>                        [NEW]     │
│  - import_profile_file(path) →                           │
│      Result<ScrollProfile, String>             [NEW]     │
├──────────────────────────────────────────────────────────┤
│  Core (crates/core/src/)                                 │
│  - profile_share.rs                            [NEW]     │
│      encode_share(&ScrollProfile) → String               │
│      decode_share(&str) → Result<ScrollProfile, Err>     │
│  - lib.rs: pub mod profile_share              [EDIT]     │
├──────────────────────────────────────────────────────────┤
│  Cargo.toml                                              │
│  - base64 = "0.22"                             [EDIT]    │
│  - flate2 = "1"                                [EDIT]    │
└──────────────────────────────────────────────────────────┘
```

## 3. Share string format

```
ssp_<base64url(gzip(json(profile)))>
```

- **Prefix `ssp_`** = "SmoothScroll Profile" — giúp người đọc nhận ra string.
- **Base64URL** (no padding) = an toàn trong URL/chat (`-_` thay vì `+/`).
- **gzip** = compress 200-300 byte JSON xuống ~120-180 byte → string tổng ~250 char.
- **JSON payload** = serialize trực tiếp `ScrollProfile`.

Example output: `ssp_H4sIAAAAAAAA_61TTWvbQBC9-1cMOgdWWtmSraYUcgilpqcSQs8r...`

### 3.1 Versioning

Wrapper struct để forward-compat:

```rust
#[derive(Serialize, Deserialize)]
struct ShareEnvelope {
    v: u8,                  // schema version, currently 1
    profile: ScrollProfile,
}
```

Decoder reject `v > MAX_VERSION` với error rõ ràng.

### 3.2 Validation

`decode_share`:
- Strip `ssp_` prefix → error nếu không có.
- Base64URL decode → error "invalid encoding".
- gzip decompress (limit 64KB output) → error "corrupted".
- JSON parse `ShareEnvelope` → error "unknown format".
- Check `v <= MAX_VERSION` → error "version too new".
- `profile.clamp()` để fix bất kỳ giá trị invalid.
- **Strip ID + regenerate UUID:** không reuse ID người gửi để tránh collision.
- **Append " (imported)" vào name** cho user biết.

## 4. JSON file format

Same `ShareEnvelope` structure, pretty-printed JSON. Filename suggested: `<profile-name>.smoothscroll.json`.

Tauri uses `tauri-plugin-dialog` (cần add nếu chưa có) cho `save_file_dialog` / `open_file_dialog`.

## 5. UI integration

### 5.1 ProfilesSection toolbar

Top of section:
```
[+ New Profile]  [⬇ Import]  [⬆ Export selected]  [🔗 Share selected]
```

- "Import" → mở `ProfileImportDialog` với 2 tab: "Paste share string" / "Import from file".
- "Export selected" (chỉ enabled khi 1 profile được hover/click) → file dialog.
- "Share selected" → `ProfileShareDialog` với readonly textarea.

### 5.2 ProfileImportDialog

```tsx
<Dialog>
  <DialogTitle>Import Profile</DialogTitle>
  <Tabs defaultValue="paste">
    <TabsList>
      <TabsTrigger value="paste">Paste string</TabsTrigger>
      <TabsTrigger value="file">From file</TabsTrigger>
    </TabsList>
    <TabsContent value="paste">
      <Textarea placeholder="ssp_..." />
      {preview && <ProfilePreview profile={preview} />}
      <Button disabled={!preview} onClick={handleImport}>Import</Button>
    </TabsContent>
    <TabsContent value="file">
      <Button onClick={openFile}>Choose file…</Button>
      {preview && <ProfilePreview profile={preview} />}
    </TabsContent>
  </Tabs>
</Dialog>
```

`ProfilePreview` hiển thị tóm tắt: tên, step_size, anim_time, easing — read-only.

### 5.3 ProfileShareDialog

```tsx
<Dialog>
  <DialogTitle>Share "{profileName}"</DialogTitle>
  <Textarea readOnly value={shareString} className="font-mono text-xs" />
  <Button onClick={copyToClipboard}>📋 Copy</Button>
  <p className="text-muted-foreground text-xs">
    Paste this string into SmoothScroll's Import dialog on another machine.
  </p>
</Dialog>
```

## 6. Settings JSON schema

Không thay đổi. Profiles imported đều qua existing `create_profile` flow.

## 7. New IPC commands

| Command | Args | Returns | Notes |
|---|---|---|---|
| `export_profile_share` | `profile_id: String` | `Result<String, String>` | Returns `ssp_...` |
| `import_profile_share` | `share: String` | `Result<ScrollProfile, String>` | Validates + creates profile |
| `export_profile_file` | `profile_id, path: String` | `Result<(), String>` | Writes JSON file |
| `import_profile_file` | `path: String` | `Result<ScrollProfile, String>` | Reads + creates profile |

Tất cả "import" commands đều **persist new profile** vào settings.json (giống `create_profile`).

## 8. Migration / risk

- **Backward compat:** chỉ thêm fields/commands mới. Existing profiles không đổi.
- **Malicious share strings:** gzip bomb risk → output limit 64KB hard. JSON depth limit qua serde defaults.
- **Schema drift:** v1 envelope means future fields có thể được forwarded. Decoder phải tolerate unknown fields qua serde `#[serde(default)]`.
- **Plugin dependency:** `tauri-plugin-dialog` chưa có trong project. Add new dep.

## 9. Testing

| Layer | Test |
|---|---|
| Core | `encode_share` round-trips qua `decode_share` |
| Core | `decode_share("invalid")` returns error |
| Core | `decode_share("ssp_AAAA")` returns "corrupted" error |
| Core | Decode rejects `v=99` envelope |
| Core | Decode handles gzip bomb attempt (>64KB) |
| Core | Imported profile gets new UUID, original ID không reused |
| Manual | Export profile → paste vào fresh install → import → settings match |

## 10. Out of scope

- QR code share
- URL share `smoothscroll://profile/...` (custom protocol handler)
- Online profile gallery
- Bulk import (multi-profile in one string)
- Encryption / signature

## 11. Build verification

```bash
cargo test -p smoothscroll_core
cargo tauri build
```

Smoke checklist:
- [ ] Tạo profile, click Share → string `ssp_...` hiển thị + copy works.
- [ ] Click Import → paste string → preview shows correct values → confirm → profile xuất hiện trong list với name " (imported)".
- [ ] Export selected → file `MyProfile.smoothscroll.json` ghi xuống disk.
- [ ] Import file → cùng kết quả như paste string.
- [ ] Paste rác → error toast "Invalid share string".
