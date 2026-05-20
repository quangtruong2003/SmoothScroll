# About Tab Support Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Support this project" card to the About tab with a Buy Me a Coffee button and VietQR-based bank-transfer info (STK 0947890450, BVBank/Timo).

**Architecture:** New presentational React component `SupportSection` rendered after `AboutSection` in the About tab. Uses VietQR online image API (no new deps), existing shadcn `Dialog` for QR zoom, existing `sonner` toast for copy feedback, and `@tauri-apps/plugin-shell` (already in use) for the BMC external link. All strings live in i18n; donation constants live as top-of-file consts.

**Tech Stack:** React 18, TypeScript, react-i18next, Tailwind, shadcn/ui (Card, Button, Dialog), sonner toasts, Tauri plugin-shell, Vitest.

**Spec:** [docs/superpowers/specs/2026-05-20-about-support-section-design.md](../specs/2026-05-20-about-support-section-design.md)

---

## File Structure

| Path | Responsibility | Status |
|---|---|---|
| `src/lib/donate.ts` | Pure constants + `buildVietQRUrl()` helper. Single source of truth for bank info & URLs. | NEW |
| `src/lib/donate.test.ts` | Vitest unit tests for `buildVietQRUrl()`. | NEW |
| `src/components/settings/SupportSection.tsx` | UI component: BMC button, QR image, STK row with copy, zoom dialog. | NEW |
| `src/routes/Settings.tsx` | Render `<SupportSection />` after `<AboutSection />` in `tab === "about"` branch. | EDIT |
| `src/i18n/locales/{en,vi,de,es,fr,hi,id,it,ja,ko,pt-BR,ru,tr,zh}.json` | Add `support.*` namespace (14 files). | EDIT |

---

## Task 1: Donation Constants & VietQR URL Builder

**Files:**
- Create: `src/lib/donate.ts`
- Create: `src/lib/donate.test.ts`

- [ ] **Step 1.1: Write the failing tests**

Create `src/lib/donate.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  BANK_ACCOUNT,
  BANK_CODE,
  BANK_DISPLAY_NAME,
  BANK_HOLDER,
  BMC_URL,
  buildVietQRUrl,
} from "./donate";

describe("donate constants", () => {
  it("exposes the BMC profile URL", () => {
    expect(BMC_URL).toBe("https://buymeacoffee.com/quangtruong2003");
  });

  it("uses BVBank as the VietQR bank code (Timo runs on BVBank)", () => {
    expect(BANK_CODE).toBe("BVBank");
    expect(BANK_DISPLAY_NAME).toBe("Timo (BVBank)");
  });

  it("exposes the account number and holder", () => {
    expect(BANK_ACCOUNT).toBe("0947890450");
    expect(BANK_HOLDER).toBe("NGUYEN QUANG TRUONG");
  });
});

describe("buildVietQRUrl", () => {
  it("builds a compact2 VietQR URL with encoded account name", () => {
    const url = buildVietQRUrl({
      bankCode: "BVBank",
      account: "0947890450",
      holder: "NGUYEN QUANG TRUONG",
    });
    expect(url).toBe(
      "https://img.vietqr.io/image/BVBank-0947890450-compact2.png?accountName=NGUYEN%20QUANG%20TRUONG",
    );
  });

  it("URL-encodes special characters in the holder name", () => {
    const url = buildVietQRUrl({
      bankCode: "BVBank",
      account: "0947890450",
      holder: "A & B",
    });
    expect(url).toContain("accountName=A%20%26%20B");
  });
});
```

- [ ] **Step 1.2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/donate.test.ts`
Expected: FAIL with module-not-found / cannot find `./donate`.

- [ ] **Step 1.3: Implement `donate.ts`**

Create `src/lib/donate.ts`:

```ts
export const BMC_URL = "https://buymeacoffee.com/quangtruong2003";
export const BANK_CODE = "BVBank";
export const BANK_ACCOUNT = "0947890450";
export const BANK_HOLDER = "NGUYEN QUANG TRUONG";
export const BANK_DISPLAY_NAME = "Timo (BVBank)";

export interface VietQRParams {
  bankCode: string;
  account: string;
  holder: string;
}

export function buildVietQRUrl({ bankCode, account, holder }: VietQRParams): string {
  const name = encodeURIComponent(holder);
  return `https://img.vietqr.io/image/${bankCode}-${account}-compact2.png?accountName=${name}`;
}

export const BANK_QR_URL = buildVietQRUrl({
  bankCode: BANK_CODE,
  account: BANK_ACCOUNT,
  holder: BANK_HOLDER,
});
```

- [ ] **Step 1.4: Run tests to verify they pass**

Run: `pnpm vitest run src/lib/donate.test.ts`
Expected: PASS — 5 tests green.

- [ ] **Step 1.5: Commit**

```bash
git add src/lib/donate.ts src/lib/donate.test.ts
git commit -m "feat(donate): add donation constants and VietQR URL builder"
```

---

## Task 2: i18n Strings (English baseline)

**Files:**
- Modify: `src/i18n/locales/en.json`

- [ ] **Step 2.1: Add `support` namespace to `en.json`**

Locate the closing `}` of the `"about": { ... }` block (around line 421 — the line with `"restart_now": "Restart now"` followed by `}`). After the closing `}` of the about block (and its trailing comma), insert a new `"support"` block. Final structure should look like:

```json
"about": {
  ...
  "restart_now": "Restart now"
},
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
},
"forced_update": {
  ...
}
```

(`forced_update` already exists — make sure the new `support` block sits between `about` and `forced_update`, both surrounded by valid commas.)

- [ ] **Step 2.2: Verify JSON validity**

Run: `pnpm tsc --noEmit`
Expected: no parse error from `en.json` (Vite/i18next imports it via JSON import). If tsc doesn't catch it, also run `node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/en.json','utf8'))"`.

- [ ] **Step 2.3: Commit**

```bash
git add src/i18n/locales/en.json
git commit -m "i18n(en): add support namespace strings"
```

---

## Task 3: i18n Strings (Vietnamese)

**Files:**
- Modify: `src/i18n/locales/vi.json`

- [ ] **Step 3.1: Add `support` namespace to `vi.json`**

Insert after the `"about"` block (which ends at `"restart_now": "Khởi động lại"` around line 285) and before the next top-level key. Use these Vietnamese translations:

```json
"support": {
  "title": "Ủng hộ dự án",
  "description": "Cảm ơn bạn đã dùng SmoothScroll. Nếu thấy hữu ích, bạn có thể mời mình một ly cà phê:",
  "buy_me_a_coffee": "Mời cà phê (Buy me a coffee)",
  "or_bank_transfer": "Hoặc chuyển khoản trực tiếp:",
  "bank_account": "Số tài khoản",
  "bank_name": "Ngân hàng",
  "copy_account": "Sao chép số tài khoản",
  "copied_toast": "Đã sao chép số tài khoản",
  "copy_failed": "Không sao chép được. Số tài khoản: {{account}}",
  "qr_load_failed": "Không tải được mã QR",
  "qr_zoom_title": "Quét để chuyển khoản",
  "qr_alt": "Mã VietQR để chuyển khoản"
},
```

Make sure preceding `}` of `about` has a trailing comma and the new block is placed between sibling top-level keys.

- [ ] **Step 3.2: Verify JSON validity**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/vi.json','utf8')); console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 3.3: Commit**

```bash
git add src/i18n/locales/vi.json
git commit -m "i18n(vi): add support namespace strings"
```

---

## Task 4: i18n Strings (Other 12 Locales)

**Files:**
- Modify: `src/i18n/locales/{de,es,fr,hi,id,it,ja,ko,pt-BR,ru,tr,zh}.json`

For each of the 12 files, add the `support` block right after the `about` block. Use the translations below (machine-translated baseline; user can refine later). Same JSON structure as Task 2.

- [ ] **Step 4.1: German (`de.json`)**

```json
"support": {
  "title": "Dieses Projekt unterstützen",
  "description": "Danke, dass du SmoothScroll nutzt. Wenn es dir hilft, kannst du mir einen Kaffee ausgeben:",
  "buy_me_a_coffee": "Einen Kaffee spendieren",
  "or_bank_transfer": "Oder per Banküberweisung:",
  "bank_account": "Kontonummer",
  "bank_name": "Bank",
  "copy_account": "Kontonummer kopieren",
  "copied_toast": "Kontonummer kopiert",
  "copy_failed": "Konnte nicht kopiert werden. Manuell: {{account}}",
  "qr_load_failed": "QR-Code konnte nicht geladen werden",
  "qr_zoom_title": "Zum Überweisen scannen",
  "qr_alt": "VietQR für Banküberweisung"
},
```

- [ ] **Step 4.2: Spanish (`es.json`)**

```json
"support": {
  "title": "Apoya este proyecto",
  "description": "Gracias por usar SmoothScroll. Si te resulta útil, puedes invitarme a un café:",
  "buy_me_a_coffee": "Invítame a un café",
  "or_bank_transfer": "O transferencia bancaria directa:",
  "bank_account": "Cuenta",
  "bank_name": "Banco",
  "copy_account": "Copiar número de cuenta",
  "copied_toast": "Número de cuenta copiado",
  "copy_failed": "No se pudo copiar. Manual: {{account}}",
  "qr_load_failed": "No se pudo cargar el QR",
  "qr_zoom_title": "Escanea para transferir",
  "qr_alt": "VietQR para transferencia bancaria"
},
```

- [ ] **Step 4.3: French (`fr.json`)**

```json
"support": {
  "title": "Soutenir ce projet",
  "description": "Merci d'utiliser SmoothScroll. Si l'app vous est utile, vous pouvez m'offrir un café :",
  "buy_me_a_coffee": "Offrir un café",
  "or_bank_transfer": "Ou virement bancaire direct :",
  "bank_account": "Compte",
  "bank_name": "Banque",
  "copy_account": "Copier le numéro de compte",
  "copied_toast": "Numéro de compte copié",
  "copy_failed": "Copie impossible. Manuel : {{account}}",
  "qr_load_failed": "Impossible de charger le QR",
  "qr_zoom_title": "Scanner pour transférer",
  "qr_alt": "VietQR pour virement bancaire"
},
```

- [ ] **Step 4.4: Hindi (`hi.json`)**

```json
"support": {
  "title": "इस प्रोजेक्ट का समर्थन करें",
  "description": "SmoothScroll उपयोग करने के लिए धन्यवाद। यदि यह उपयोगी लगे तो आप मुझे एक कॉफ़ी ऑफ़र कर सकते हैं:",
  "buy_me_a_coffee": "एक कॉफ़ी ऑफ़र करें",
  "or_bank_transfer": "या सीधे बैंक ट्रांसफर:",
  "bank_account": "खाता",
  "bank_name": "बैंक",
  "copy_account": "खाता संख्या कॉपी करें",
  "copied_toast": "खाता संख्या कॉपी हो गई",
  "copy_failed": "कॉपी नहीं हो सकी। मैन्युअल: {{account}}",
  "qr_load_failed": "QR लोड नहीं हो सका",
  "qr_zoom_title": "ट्रांसफर के लिए स्कैन करें",
  "qr_alt": "बैंक ट्रांसफर के लिए VietQR"
},
```

- [ ] **Step 4.5: Indonesian (`id.json`)**

```json
"support": {
  "title": "Dukung proyek ini",
  "description": "Terima kasih sudah pakai SmoothScroll. Kalau berguna, kamu bisa traktir saya kopi:",
  "buy_me_a_coffee": "Traktir kopi",
  "or_bank_transfer": "Atau transfer bank langsung:",
  "bank_account": "Rekening",
  "bank_name": "Bank",
  "copy_account": "Salin nomor rekening",
  "copied_toast": "Nomor rekening disalin",
  "copy_failed": "Gagal menyalin. Manual: {{account}}",
  "qr_load_failed": "QR gagal dimuat",
  "qr_zoom_title": "Pindai untuk transfer",
  "qr_alt": "VietQR untuk transfer bank"
},
```

- [ ] **Step 4.6: Italian (`it.json`)**

```json
"support": {
  "title": "Supporta questo progetto",
  "description": "Grazie per usare SmoothScroll. Se ti è utile, puoi offrirmi un caffè:",
  "buy_me_a_coffee": "Offri un caffè",
  "or_bank_transfer": "Oppure bonifico diretto:",
  "bank_account": "Conto",
  "bank_name": "Banca",
  "copy_account": "Copia numero di conto",
  "copied_toast": "Numero di conto copiato",
  "copy_failed": "Impossibile copiare. Manuale: {{account}}",
  "qr_load_failed": "Impossibile caricare il QR",
  "qr_zoom_title": "Scansiona per trasferire",
  "qr_alt": "VietQR per bonifico bancario"
},
```

- [ ] **Step 4.7: Japanese (`ja.json`)**

```json
"support": {
  "title": "このプロジェクトをサポート",
  "description": "SmoothScroll をご利用いただきありがとうございます。お役に立てたなら、コーヒーをご馳走してください:",
  "buy_me_a_coffee": "コーヒーをおごる",
  "or_bank_transfer": "または直接送金:",
  "bank_account": "口座",
  "bank_name": "銀行",
  "copy_account": "口座番号をコピー",
  "copied_toast": "口座番号をコピーしました",
  "copy_failed": "コピーできませんでした。手動: {{account}}",
  "qr_load_failed": "QRを読み込めませんでした",
  "qr_zoom_title": "スキャンして送金",
  "qr_alt": "銀行送金用 VietQR"
},
```

- [ ] **Step 4.8: Korean (`ko.json`)**

```json
"support": {
  "title": "이 프로젝트 후원하기",
  "description": "SmoothScroll을 사용해 주셔서 감사합니다. 도움이 되셨다면 커피 한 잔 사주세요:",
  "buy_me_a_coffee": "커피 한 잔 사주기",
  "or_bank_transfer": "또는 직접 송금:",
  "bank_account": "계좌",
  "bank_name": "은행",
  "copy_account": "계좌번호 복사",
  "copied_toast": "계좌번호가 복사되었습니다",
  "copy_failed": "복사하지 못했습니다. 수동: {{account}}",
  "qr_load_failed": "QR을 불러오지 못했습니다",
  "qr_zoom_title": "스캔하여 송금",
  "qr_alt": "은행 송금용 VietQR"
},
```

- [ ] **Step 4.9: Portuguese-BR (`pt-BR.json`)**

```json
"support": {
  "title": "Apoie este projeto",
  "description": "Obrigado por usar o SmoothScroll. Se for útil, você pode me pagar um café:",
  "buy_me_a_coffee": "Pagar um café",
  "or_bank_transfer": "Ou transferência bancária direta:",
  "bank_account": "Conta",
  "bank_name": "Banco",
  "copy_account": "Copiar número da conta",
  "copied_toast": "Número da conta copiado",
  "copy_failed": "Não foi possível copiar. Manual: {{account}}",
  "qr_load_failed": "Não foi possível carregar o QR",
  "qr_zoom_title": "Escaneie para transferir",
  "qr_alt": "VietQR para transferência bancária"
},
```

- [ ] **Step 4.10: Russian (`ru.json`)**

```json
"support": {
  "title": "Поддержать проект",
  "description": "Спасибо, что используете SmoothScroll. Если он вам полезен, можете угостить меня кофе:",
  "buy_me_a_coffee": "Купить кофе",
  "or_bank_transfer": "Или прямой банковский перевод:",
  "bank_account": "Счёт",
  "bank_name": "Банк",
  "copy_account": "Копировать номер счёта",
  "copied_toast": "Номер счёта скопирован",
  "copy_failed": "Не удалось скопировать. Вручную: {{account}}",
  "qr_load_failed": "Не удалось загрузить QR",
  "qr_zoom_title": "Отсканируйте для перевода",
  "qr_alt": "VietQR для банковского перевода"
},
```

- [ ] **Step 4.11: Turkish (`tr.json`)**

```json
"support": {
  "title": "Bu projeyi destekle",
  "description": "SmoothScroll kullandığın için teşekkürler. Faydalı buluyorsan bana bir kahve ısmarlayabilirsin:",
  "buy_me_a_coffee": "Bir kahve ısmarla",
  "or_bank_transfer": "Ya da doğrudan havale:",
  "bank_account": "Hesap",
  "bank_name": "Banka",
  "copy_account": "Hesap numarasını kopyala",
  "copied_toast": "Hesap numarası kopyalandı",
  "copy_failed": "Kopyalanamadı. Manuel: {{account}}",
  "qr_load_failed": "QR yüklenemedi",
  "qr_zoom_title": "Havale için tara",
  "qr_alt": "Banka havalesi için VietQR"
},
```

- [ ] **Step 4.12: Chinese (`zh.json`)**

```json
"support": {
  "title": "支持这个项目",
  "description": "感谢使用 SmoothScroll。如果觉得有用,可以请我喝杯咖啡:",
  "buy_me_a_coffee": "请我喝杯咖啡",
  "or_bank_transfer": "或直接银行转账:",
  "bank_account": "账户",
  "bank_name": "银行",
  "copy_account": "复制账号",
  "copied_toast": "账号已复制",
  "copy_failed": "复制失败。手动: {{account}}",
  "qr_load_failed": "无法加载二维码",
  "qr_zoom_title": "扫码转账",
  "qr_alt": "用于银行转账的 VietQR"
},
```

- [ ] **Step 4.13: Validate all 12 locale JSON files**

Run:

```bash
for f in de es fr hi id it ja ko pt-BR ru tr zh; do
  node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/$f.json','utf8'))" || echo "FAIL: $f"
done
echo "all parsed"
```

Expected: prints `all parsed` with no `FAIL:` lines.

- [ ] **Step 4.14: Commit**

```bash
git add src/i18n/locales/de.json src/i18n/locales/es.json src/i18n/locales/fr.json \
        src/i18n/locales/hi.json src/i18n/locales/id.json src/i18n/locales/it.json \
        src/i18n/locales/ja.json src/i18n/locales/ko.json src/i18n/locales/pt-BR.json \
        src/i18n/locales/ru.json src/i18n/locales/tr.json src/i18n/locales/zh.json
git commit -m "i18n: add support namespace for 12 remaining locales"
```

---

## Task 5: Build the SupportSection component

**Files:**
- Create: `src/components/settings/SupportSection.tsx`

- [ ] **Step 5.1: Create `SupportSection.tsx`**

```tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { open } from "@tauri-apps/plugin-shell";
import { Coffee, Copy, QrCode } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import {
  BANK_ACCOUNT,
  BANK_DISPLAY_NAME,
  BANK_QR_URL,
  BMC_URL,
} from "@/lib/donate";

export function SupportSection() {
  const { t } = useTranslation();
  const [zoomOpen, setZoomOpen] = useState(false);
  const [qrFailed, setQrFailed] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(BANK_ACCOUNT);
      toast.success(t("support.copied_toast"));
    } catch {
      toast.error(t("support.copy_failed", { account: BANK_ACCOUNT }));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coffee className="h-4 w-4" />
          {t("support.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-muted-foreground">{t("support.description")}</p>

        <Button
          className="w-full gap-2"
          onClick={() => void open(BMC_URL)}
        >
          <Coffee className="h-4 w-4" />
          {t("support.buy_me_a_coffee")}
        </Button>

        <div className="border-t pt-3">
          <p className="text-muted-foreground mb-2">
            {t("support.or_bank_transfer")}
          </p>
          <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-3">
            <button
              type="button"
              onClick={() => !qrFailed && setZoomOpen(true)}
              className="shrink-0 rounded-md overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label={t("support.qr_zoom_title")}
              disabled={qrFailed}
            >
              {qrFailed ? (
                <div className="flex h-[120px] w-[120px] flex-col items-center justify-center bg-muted text-muted-foreground">
                  <QrCode className="h-8 w-8 mb-1" />
                  <span className="text-[10px] text-center px-1">
                    {t("support.qr_load_failed")}
                  </span>
                </div>
              ) : (
                <img
                  src={BANK_QR_URL}
                  alt={t("support.qr_alt")}
                  width={120}
                  height={120}
                  loading="lazy"
                  onError={() => setQrFailed(true)}
                />
              )}
            </button>

            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">
                  {t("support.bank_account")}
                </span>
                <div className="flex items-center gap-1">
                  <span className="font-medium tabular-nums">
                    {BANK_ACCOUNT}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={onCopy}
                    aria-label={t("support.copy_account")}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">
                  {t("support.bank_name")}
                </span>
                <span className="font-medium">{BANK_DISPLAY_NAME}</span>
              </div>
            </div>
          </div>
        </div>

        <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t("support.qr_zoom_title")}</DialogTitle>
            </DialogHeader>
            <div className="flex justify-center">
              <img
                src={BANK_QR_URL}
                alt={t("support.qr_alt")}
                width={480}
                height={480}
                className="rounded-md"
              />
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5.2: Type-check**

Run: `pnpm tsc --noEmit`
Expected: no errors. If `Button size="icon"` is missing, fall back to `size="sm"` and adjust className accordingly. If `lucide-react` icon names differ, replace with closest available (verify with `grep -r "from \"lucide-react\"" src | head`).

- [ ] **Step 5.3: Commit**

```bash
git add src/components/settings/SupportSection.tsx
git commit -m "feat(settings): add SupportSection with BMC button and VietQR"
```

---

## Task 6: Wire SupportSection into the About tab

**Files:**
- Modify: `src/routes/Settings.tsx`

- [ ] **Step 6.1: Add import**

Open `src/routes/Settings.tsx`. Find the existing import line:

```ts
import { AboutSection } from "@/components/settings/AboutSection";
```

Add directly below it:

```ts
import { SupportSection } from "@/components/settings/SupportSection";
```

- [ ] **Step 6.2: Render in About tab**

Find the block (around line 178):

```tsx
{tab === "about" && (
  <TabContent
    title={t("tabs.about.title")}
    description={t("tabs.about.description")}
    scrollable={true}
  >
    <AboutSection />
  </TabContent>
)}
```

Add `<SupportSection />` directly after `<AboutSection />`:

```tsx
{tab === "about" && (
  <TabContent
    title={t("tabs.about.title")}
    description={t("tabs.about.description")}
    scrollable={true}
  >
    <AboutSection />
    <SupportSection />
  </TabContent>
)}
```

If `<TabContent>` does not natively stack children with spacing, wrap in a `<div className="space-y-4">…</div>`. Verify by reading lines around 178 of `Settings.tsx` first to match the existing pattern (other tabs likely already use multiple sections — copy that pattern exactly).

- [ ] **Step 6.3: Type-check & build**

Run: `pnpm tsc --noEmit`
Expected: passes.

Run: `pnpm build`
Expected: build succeeds, no warnings about missing translation keys.

- [ ] **Step 6.4: Commit**

```bash
git add src/routes/Settings.tsx
git commit -m "feat(settings): render SupportSection in About tab"
```

---

## Task 7: Manual Verification (golden path)

**Files:** none (manual app run).

- [ ] **Step 7.1: Launch dev app**

Run: `pnpm tauri dev`
Expected: app boots without runtime errors.

- [ ] **Step 7.2: Navigate to About tab → verify Support card appears below About card**

Pass criteria:
- Card title shows "Support this project" (or current locale equivalent).
- Description paragraph visible.
- Full-width "Buy me a coffee" button visible with coffee icon.
- 120×120 VietQR image renders.
- STK row shows `0947890450` with copy icon button.
- Bank row shows `Timo (BVBank)`.
- No "Holder/Tên" row shown.

- [ ] **Step 7.3: BMC click → external browser opens**

Click "Buy me a coffee".
Expected: default browser opens to `https://buymeacoffee.com/quangtruong2003`.

- [ ] **Step 7.4: QR thumbnail click → zoom dialog opens**

Click QR image.
Expected: dialog shows large 480×480 QR; closes via Esc / outside click.

- [ ] **Step 7.5: Copy button → clipboard contains `0947890450`**

Click copy button. Paste into any text field.
Expected: `0947890450`. Toast appears with "Account number copied" / "Đã sao chép số tài khoản".

- [ ] **Step 7.6: Offline fallback**

Disable network → reload App or switch tabs back to About.
Expected: QR area shows placeholder with QR icon and "Could not load QR" text. STK row still shows; copy still works.

- [ ] **Step 7.7: Locale check**

Switch language to Vietnamese, then to one other (e.g., Japanese).
Expected: all support strings translated; no raw `support.xxx` keys visible.

- [ ] **Step 7.8: No commit needed (verification only)**

If any step fails, fix and commit a `fix:` patch before declaring done.

---

## Task 8: Final sweep

- [ ] **Step 8.1: Run full test suite**

Run: `pnpm test`
Expected: all tests pass (existing + new `donate.test.ts`).

- [ ] **Step 8.2: Run lint / typecheck**

Run: `pnpm tsc --noEmit && pnpm build`
Expected: clean.

- [ ] **Step 8.3: Verify no untracked artifacts**

Run: `git status`
Expected: only intended files.

- [ ] **Step 8.4: Done**

All 8 tasks complete. Plan terminates.

---

## Self-Review (already done)

- **Spec coverage:** ✅ Every spec section (BMC URL, VietQR builder, zoom dialog, copy with toast, offline fallback, 14 locales, holder hidden, integration into About tab) maps to a task.
- **Placeholders:** ✅ None — all code, paths, and commands are concrete.
- **Type consistency:** ✅ `BMC_URL`, `BANK_ACCOUNT`, `BANK_DISPLAY_NAME`, `BANK_QR_URL`, `buildVietQRUrl()` used identically across Tasks 1, 5, 7.
- **Holder removal:** ✅ Confirmed — UI shows STK + Bank only; holder is encoded in `accountName` URL param so it auto-displays in user's banking app on scan.
