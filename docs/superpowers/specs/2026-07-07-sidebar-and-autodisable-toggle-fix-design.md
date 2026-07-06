# Sidebar spacing cleanup + auto-disable Windows apps toggle fix

**Date:** 2026-07-07
**Status:** Draft (pre-approval)
**Scope:** (1) Sidebar UX: items dính sát nhau, cần vertical spacing chuẩn. (2) Bug fix: toggle "Tự tắt trong app Windows" trong tab Behavior không có hiệu lực thực tế — khi tắt, các app Windows mặc định vẫn bị auto-excluded.

---

## 1. Background / Root cause

### 1a. Sidebar items dính nhau

File `src/components/Sidebar.tsx` định nghĩa mỗi item là:

```tsx
<button
  className="sidebar-item relative flex items-center gap-2 text-left text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
>
  {tab.icon}
  <span>{t(tab.labelKey)}</span>
</button>
```

Không có `py-*` (vertical padding), chỉ có `gap-2` cho khoảng cách icon ↔ label trên cùng dòng. Kết quả: các items xếp sát nhau theo đúng line-height của `text-sm` (~20px), nhìn chật và click-target quá nhỏ. Đây là vấn đề cosmetic / UX thuần.

Xem ảnh đính kèm của user: items dồn cục, không có hit-target rõ ràng.

### 1b. Toggle "Tự tắt trong app Windows" không hiệu lực

Hai cơ chế exclude tồn tại song song trong `crates/core/src/settings.rs` và `src-tauri/src/hook_wiring.rs`:

1. **`should_auto_disable_windows_app()`** (Rust) — runtime check dựa trên flag `auto_disable_windows_apps` + `NATIVE_SMOOTH_SEED` (Notepad, Settings, Photos, Calculator, msedge, ApplicationFrameHost, WinStore).
2. **`is_excluded()`** (Rust) — check `app_profiles[process] == "__disabled__"` (user gán thủ công) HOẶC `excluded_apps` (legacy).

Trong `src-tauri/src/hook_wiring.rs` dòng 130-139:

```rust
if let Some(process_name) = under_cursor.as_deref() {
    if s.is_excluded(process_name) || s.should_auto_disable_windows_app(process_name) {
        ...
        return None;
    }
    ...
}
```

**`is_excluded` chạy trước `should_auto_disable_windows_app`.** Phiên bản cũ của app (trước refactor mà đã biến `seed_native_smooth_excludes` thành no-op) đã migrate các app trong `NATIVE_SMOOTH_SEED` vào `app_profiles` với value `__disabled__`. Sau refactor, code không auto-cleanup các entries cũ này. Hệ quả:

- User toggle `auto_disable_windows_apps = false` → `should_auto_disable_windows_app` returns `false` ✓
- NHƯNG `is_excluded(app)` vẫn returns `true` vì `app_profiles["Notepad.exe"] == "__disabled__"` (legacy leftover)
- Hook bỏ qua app Windows, scroll không được apply
- User nhìn thấy UI toggle thay đổi nhưng behavior không đổi → cảm giác bug

User đã confirm scenario: tắt toggle ngay lập tức → chuyển sang app Windows mặc định → vẫn không smooth-scroll. Không phải race condition hay debounce; là logic exclude cũ còn dính.

---

## 2. Goals

1. **Sidebar** — mỗi item có vertical spacing rõ ràng, click-target đủ rộng (≥ 32px height), visual phân biệt active/hover. Đạt cảm giác "comfortable" (không dense, không spacious).
2. **Toggle fix** — bật/tắt `auto_disable_windows_apps` phải phản ánh đúng behavior ngay lập tức, không cần restart.
3. Không thay đổi API công khai; không break existing flows; không thêm abstraction.

## 3. Non-goals

- Không refactor architecture của `is_excluded` / `should_auto_disable_windows_app`.
- Không migration one-time khi load settings (sẽ là Approach B; quá phức tạp so với lợi ích).
- Không redesign visual identity (icons, colors) — chỉ spacing + active states.
- Không touch `app_profiles` UI trong tab "Apps" (user tự add/remove thủ công).
- Không yêu cầu restart app để fix.

---

## 4. Design

### 4.1 Sidebar items (src/components/Sidebar.tsx)

Thay đổi className của `<button>`:

```tsx
className={cn(
  "relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm font-medium",
  "transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
  isActive
    ? "bg-accent text-foreground"
    : "text-muted-foreground hover:bg-accent hover:text-foreground",
)}
```

**Spacing breakdown:**
- `gap-2.5` (10px) — icon ↔ label, tăng nhẹ so với `gap-2` (8px) cho balance với item cao hơn
- `px-2.5` (10px) — chừa mép ngang
- `py-2` (8px×2 = 16px) — vertical padding, kết hợp với line-height ~20px → mỗi item cao ~36px
- `rounded-md` — khớp các UI element khác trong app
- `w-full` — fill chiều ngang nav container

**States:**
- **Active**: `bg-accent text-foreground` (giữ consistency với theme tokens đã có trong Tailwind config)
- **Inactive**: `text-muted-foreground` + hover `bg-accent hover:text-foreground`
- Focus ring giữ nguyên (`focus-visible:ring-2 focus-visible:ring-ring`)

**Width:** container `w-44` (176px) đủ rộng cho label "Game mode" dài nhất (~78px) + icon 16px + padding 20px = ~114px. Còn ~62px buffer. OK giữ width.

**Active indicator (optional polish):** absolute left bar. Skip cho lần này — visual contrast của `bg-accent` đã đủ. Không over-engineer.

### 4.2 Cleanup stale `__disabled__` entries cho native apps

Trong **frontend** `src/components/settings/BehaviorSection.tsx`, handler `onAutoDisableWindowsApps`:

```tsx
const onAutoDisableWindowsApps = async (next: boolean) => {
  // 1. Toggle the flag (in-memory + persisted)
  patch({ auto_disable_windows_apps: next });

  // 2. ON → OFF: drop legacy __disabled__ entries for native-smooth apps
  //    (bị gán từ version cũ trước khi seed_native_smooth_excludes thành no-op)
  if (!next && settings) {
    const NATIVE_SEED = [
      "Notepad.exe", "SystemSettings.exe", "ApplicationFrameHost.exe",
      "CalculatorApp.exe", "Photos.exe", "WinStore.App.exe", "msedge.exe",
    ];
    for (const app of NATIVE_SEED) {
      if (settings.app_profiles[app] === "__disabled__") {
        try {
          await unassignAppProfile(app);
        } catch (e) {
          console.error("cleanup failed for", app, e);
        }
      }
    }
  }
};
```

Cần expose `unassignAppProfile` từ store (đã có ở `src/stores/settingsStore.ts:157`). Selector:

```tsx
const unassignAppProfile = useSettingsStore((s) => s.unassignAppProfile);
const settings = useSettingsStore((s) => s.settings);
```

**Tại sao đặt ở frontend, không phải backend?**
- Cleanup chỉ cần chạy khi user **explicit** toggle ON→OFF từ UI Behavior tab → handler đã có sẵn.
- Backend cleanup rủi ro cao hơn (chạy ngầm khi load → ăn vào user data không mong muốn).
- Frontend cleanup là "one intent": user nói "tôi không muốn loại Windows apps" → kết quả phải là "Windows apps không bị exclude".

**Edge case:** User tự tay add Notepad vào Apps tab (select `__disabled__`), rồi tắt toggle Windows apps → Notepad sẽ tự động bỏ exclude. Hiếm nhưng không mong muốn. Theo tradeoff, chấp nhận — user đã chọn ON→OFF toggle là signal explicit "tôi muốn tất cả Windows native apps không bị auto-disable". Cleanup chỉ chạy khi toggle ON→OFF, không chạy khi add app thủ công.

### 4.3 Sequence: toggle ON→OFF

```
User clicks switch
  ↓
onAutoDisableWindowsApps(false)
  ↓
patch({ auto_disable_windows_apps: false })  ─── in-memory state update, debounced 350ms persist
  ↓
await unassignAppProfile("Notepad.exe")  ─── goes through tauri.invoke → commands.rs::unassign_app_profile
  ↓                                          removes from app_profiles, commits settings, persists
  ↓
(for each NATIVE_SEED app present in app_profiles with __disabled__)
  ↓
Rust hook_wiring.rs next wheel event:
  s.is_excluded("Notepad.exe") → false (cleaned)
  s.should_auto_disable_windows_app("Notepad.exe") → false (flag off)
  → resolve_active returns Some(effective) → SMOOTH SCROLL APPLIED ✓
```

Time to effect: ~immediate (microseconds per Tauri invoke roundtrip × 7 apps ≈ tens of ms). User thấy behavior đổi trong vòng 1 frame sau khi switch toggle complete.

---

## 5. Files changed

| File | Change |
|------|--------|
| `src/components/Sidebar.tsx` | Update className của sidebar item button: thêm `w-full`, `px-2.5`, `py-2`, `gap-2.5`, `rounded-md`, active/inactive state classes |
| `src/components/settings/BehaviorSection.tsx` | Import `unassignAppProfile` từ settingsStore; extend `onAutoDisableWindowsApps` để cleanup `__disabled__` entries khi ON→OFF |

**No backend changes.** Không touch Rust.

---

## 6. Testing

### Manual checklist (sidebar)
- [ ] Sidebar render: 7 items visible (Scroll, Devices, Advanced, Apps, Game mode, Behavior, About)
- [ ] Mỗi item có height ~36px, không bị dính nhau
- [ ] Click item → active state với `bg-accent` rõ ràng
- [ ] Hover inactive item → `bg-accent hover:text-foreground` rõ ràng
- [ ] Active item visually khác hover-inactive
- [ ] Keyboard Tab qua các items → focus ring hiện
- [ ] Trên dark theme và light theme đều OK (test cả 2)
- [ ] Footer (theme switcher, language select, version) không bị ảnh hưởng

### Manual checklist (toggle fix)
- [ ] Prerequisite: settings file có chứa `app_profiles["Notepad.exe"] = "__disabled__"` (giả lập bằng cách edit settings.json, hoặc dùng version cũ backup)
- [ ] Mở Settings → Behavior → bật toggle "Tự tắt trong app Windows" (default true), mở Notepad, scroll vẫn bình thường (Notepad bị pass-through vì 2 lý do — auto flag + app_profiles entry)
- [ ] Tắt toggle → đợi toast/UI feedback xong
- [ ] Quay lại Notepad, scroll thử → SmoothScroll phải áp dụng (animated, không cứng)
- [ ] Lặp lại với SystemSettings, Photos
- [ ] Re-start app, kiểm tra settings persist (`auto_disable_windows_apps = false`, `app_profiles` không còn entries `__disabled__` cho native apps)
- [ ] Edge: User tắt toggle khi `app_profiles` không có stale entries → không có lỗi, chỉ idempotent no-op
- [ ] Edge: User bật lại toggle (OFF → ON) → KHÔNG cleanup (one-way cleanup chỉ ON→OFF), behavior như cũ

### Automated tests
- Sidebar: không có test tự động hiện tại cho visual; dựa vào manual checklist
- Toggle fix: viết test nhỏ trong `src/stores/settingsStore.test.ts` mock Tauri commands và assert `unassignAppProfile` được gọi đúng khi toggle ON→OFF với stale entry. Test ID ngắn gọn: `cleanup_native_disabled_on_toggle_off`.

---

## 7. Rollout

- **Risk:** Thấp. Changes scoped, không touch hot path. Cleanup chỉ chạy khi user toggle explicit ON→OFF.
- **Rollback:** Revert 1 commit revert Sidebar.tsx + BehaviorSection.tsx.
- **Build:** Không cần rebuild WASM (logic ở React + hook Rust đã sẵn). Build Tauri bình thường.

---

## 8. Open questions

- **Q1:** Cleanup có nên log 1 toast kiểu "Đã loại bỏ N app khỏi danh sách loại trừ" cho user feedback? → **Decision: không thêm toast.** Minimal scope, cleanup là kết quả mong đợi của user intent. Nếu user phản hồi muốn feedback thì add sau.
- **Q2:** Width sidebar hiện `w-44` (176px) — có nên bump `w-48` (192px) cho thoáng hơn với items cao 36px? → **Recommendation: giữ w-44**, để tránh layout shift. Nếu user feedback sau, có thể bump.

---

## 9. Out of scope (later)

- Visual redesign of active state (e.g., left indicator bar).
- Width tuning.
- Animation on tab change.
- Persisting `auto_disable_windows_apps` per-profile.
