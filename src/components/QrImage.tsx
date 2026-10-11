import { useState } from "react";
import { useTranslation } from "react-i18next";
import { QrCode } from "lucide-react";

/**
 * QR preview with a placeholder fallback. VietQR is served over HTTP, so the
 * image can fail on flaky networks — show the bank details slot instead of a
 * broken image.
 */
export function QrImage({ src }: { src: string }) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="flex h-[320px] w-[320px] flex-col items-center justify-center bg-muted text-muted-foreground rounded-md">
        <QrCode className="h-12 w-12 mb-2" />
        <span className="text-sm text-center px-2">{t("support.qr_load_failed")}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={t("support.qr_alt")}
      width={480}
      height={480}
      className="rounded-md"
      onError={() => setFailed(true)}
    />
  );
}
