# Support Section in About Tab — Design Spec

**Date:** 2026-05-20
**Author:** Nguyễn Quang Trường
**Status:** Approved (pending implementation)

## Goal

Thêm khu vực "Support this project" vào tab About để người dùng có thể ủng hộ tác giả qua Buy Me a Coffee hoặc chuyển khoản ngân hàng (VietQR).

## User Story

Là người dùng SmoothScroll, sau khi xài app một thời gian và thấy hữu ích, tôi muốn có cách dễ dàng để gửi tip cho tác giả — qua thẻ quốc tế (Buy Me a Coffee) hoặc chuyển khoản nội địa (QR ngân hàng).

## Scope

**In scope:**
- Card mới `SupportSection` hiển thị ngay dưới `AboutSection` trong tab About.
- Nút Buy Me a Coffee mở external URL.
- Khu vực hiển thị QR VietQR (ảnh fetch online từ `img.vietqr.io`) + thông tin tài khoản dạng text + nút copy STK.
- Click ảnh QR → mở dialog phóng to để dễ scan bằng app banking khác.
- i18n cho cả 14 locale.

**Out of scope:**
- Backend Rust changes (không cần).
- Tracking/analytics donate clicks.
- In-app payment processing.
- Đa ngân hàng / đa tài khoản (chỉ 1 STK Timo).
- Local fallback ảnh QR (online-only; nếu offline thì hiển thị placeholder + giữ STK text).

## UI Design

### Layout

```
┌─ Card "Support this project" ──────────────────┐
│ ☕ Header                                       │
│ Cảm ơn bạn đã dùng SmoothScroll. Nếu thấy hữu  │
│ ích, có thể ủng hộ tác giả ly cà phê:          │
│                                                 │
│ ┌─────────────────────────────────────────────┐│
│ │ ☕ Buy me a coffee              [→ ext]    ││  primary, full width
│ └─────────────────────────────────────────────┘│
│                                                 │
│ Hoặc chuyển khoản trực tiếp:                   │
│ ┌──────────┬─────────────────────────────────┐ │
│ │ [QR img] │ STK   0947890450        [📋]   │ │
│ │ 120×120  │ Bank  Timo (BVBank)            │ │
│ │ click→   │ (tên hiển thị tự động khi scan) │ │
│ │ zoom     │                                 │ │
│ └──────────┴─────────────────────────────────┘ │
└────────────────────────────────────────────────┘
```

### Components

**`SupportSection.tsx`** (new, ~140 lines)
- Card wrapper with header "Support this project" + coffee emoji.
- Description paragraph (i18n).
- Primary button "Buy me a coffee" full-width → `open(BMC_URL)`.
- Divider/subhead "Hoặc chuyển khoản trực tiếp:".
- Bank info row:
  - Left: `<img>` 120×120 from `BANK_QR_URL`, clickable.
  - Right: 2 rows (STK / Bank) using same row pattern as AboutSection, with copy button on STK row. Tên người nhận không show trên UI — sẽ tự hiển thị trên app banking khi scan QR (VietQR truyền `accountName` qua URL param).
- Click QR thumbnail → opens dialog (Radix Dialog already in shadcn ui) showing QR at 480×480.
- Copy button uses `navigator.clipboard.writeText(BANK_ACCOUNT)`, shows toast "Đã copy STK" (use existing toast system).

### Constants (top of file)

```ts
const BMC_URL = "https://buymeacoffee.com/quangtruong2003";
const BANK_CODE = "BVBank";
const BANK_ACCOUNT = "0947890450";
const BANK_HOLDER = "NGUYEN QUANG TRUONG";
const BANK_DISPLAY_NAME = "Timo (BVBank)";
const BANK_QR_URL = `https://img.vietqr.io/image/${BANK_CODE}-${BANK_ACCOUNT}-compact2.png?accountName=${encodeURIComponent(BANK_HOLDER)}`;
```

### Edge cases
- **Offline / VietQR fail:** `<img onError>` → hiển thị placeholder div với icon QR + text "Không tải được QR". Text STK/Bank/Holder vẫn hiển thị, copy button vẫn hoạt động.
- **Clipboard API unavailable:** catch error, toast lỗi "Không copy được, hãy chép thủ công: 0947890450".
- **External link:** dùng `open()` từ `@tauri-apps/plugin-shell` (đã có sẵn trong AboutSection).

## File Changes

| File | Change | Reason |
|---|---|---|
| `src/components/settings/SupportSection.tsx` | NEW | Component chính |
| `src/routes/Settings.tsx` | EDIT | Render `<SupportSection />` sau `<AboutSection />` trong tab `about` |
| `src/i18n/locales/en.json` | EDIT | Add `support.*` namespace |
| `src/i18n/locales/vi.json` | EDIT | Add `support.*` namespace |
| `src/i18n/locales/de.json` | EDIT | Add `support.*` namespace |
| `src/i18n/locales/es.json` | EDIT | Add `support.*` namespace |
| `src/i18n/locales/fr.json` | EDIT | Add `support.*` namespace |
| `src/i18n/locales/hi.json` | EDIT | Add `support.*` namespace |
| `src/i18n/locales/id.json` | EDIT | Add `support.*` namespace |
| `src/i18n/locales/it.json` | EDIT | Add `support.*` namespace |
| `src/i18n/locales/ja.json` | EDIT | Add `support.*` namespace |
| `src/i18n/locales/ko.json` | EDIT | Add `support.*` namespace |
| `src/i18n/locales/pt-BR.json` | EDIT | Add `support.*` namespace |
| `src/i18n/locales/ru.json` | EDIT | Add `support.*` namespace |
| `src/i18n/locales/tr.json` | EDIT | Add `support.*` namespace |
| `src/i18n/locales/zh.json` | EDIT | Add `support.*` namespace |

## i18n Keys

```json
"support": {
  "title": "Support this project",
  "description": "Thanks for using SmoothScroll. If you find it useful, you can buy me a coffee:",
  "buy_me_a_coffee": "Buy me a coffee",
  "or_bank_transfer": "Or transfer directly:",
  "bank_account": "Account",
  "bank_name": "Bank",
  "copy_account": "Copy account number",
  "copied_toast": "Account number copied",
  "copy_failed": "Could not copy. Manual: {{account}}",
  "qr_load_failed": "Could not load QR",
  "qr_zoom_title": "Scan to transfer",
  "qr_alt": "VietQR for bank transfer"
}
```

(Vietnamese translations for vi.json, machine-translated equivalents for the other 12 locales.)

## Data Flow

```
User clicks "Buy me a coffee"
  └─→ open(BMC_URL) via @tauri-apps/plugin-shell
       └─→ Default browser opens buymeacoffee.com/quangtruong2003

User clicks QR thumbnail
  └─→ setOpen(true) on Dialog
       └─→ Renders 480×480 <img src={BANK_QR_URL} />

User clicks copy button
  └─→ navigator.clipboard.writeText(BANK_ACCOUNT)
       ├─→ success: toast(t("support.copied_toast"))
       └─→ failure: toast(t("support.copy_failed", { account: BANK_ACCOUNT }))
```

## Non-functional

- **Privacy:** VietQR image fetched from `img.vietqr.io` with no PII beyond what's already on the QR (STK + bank + holder name, all already public on any transfer receipt).
- **Performance:** Single 120×120 image load, lazy. No JS bundle impact (no new deps).
- **Accessibility:**
  - QR `<img>` has `alt={t("support.qr_alt")}`.
  - Buttons have `aria-label`.
  - Dialog uses Radix → keyboard nav + focus trap free.

## Testing

Manual checklist:
- [ ] Tab About hiển thị thêm card Support dưới card About.
- [ ] Nút BMC mở browser đến đúng URL.
- [ ] Ảnh QR load thành công khi online.
- [ ] Click QR → dialog phóng to xuất hiện.
- [ ] Copy STK → toast hiển thị, paste ra notepad đúng "0947890450".
- [ ] Tắt mạng → reload tab About → QR fail gracefully (placeholder + text vẫn copy được).
- [ ] Đổi locale sang vi/en/zh → text dịch đúng.

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| VietQR API changes URL format | Constants ở top of file dễ sửa; nếu cần thì swap sang local PNG |
| BVBank không phải mã đúng cho Timo | Verify khi review (Timo Plus = BVBank, code 970454). Nếu sai, đổi `BANK_CODE` constant. |
| User scan QR nhưng số tiền/nội dung không tự điền | Acceptable; QR `compact2` để user tự nhập (không hardcode amount = an toàn hơn) |
| Nút donate quá nổi gây cảm giác "nag" | Card đặt trong tab About (không phải tab Chung); user phải chủ động vào |

## Confirmed Decisions

1. Bank code `BVBank` is correct for the Timo account (BIN 970454).
2. Holder name is passed to VietQR via `accountName` URL param so it auto-displays in the user's banking app on scan — UI does not need a "Holder" row.
3. UI shows only STK + Bank (2 rows). Holder name is intentionally hidden from the on-screen text.
