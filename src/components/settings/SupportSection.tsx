import { useState } from "react";
import { useTranslation } from "react-i18next";
import { QrCode } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BANK_QR_URL } from "@/lib/donate";

export function SupportSection() {
  const { t } = useTranslation();
  const [zoomOpen, setZoomOpen] = useState(false);
  const [qrFailed, setQrFailed] = useState(false);

  return (
    <div className="flex justify-center">
      <button
        type="button"
        onClick={() => !qrFailed && setZoomOpen(true)}
        className="rounded-md overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-default"
        aria-label={t("support.qr_zoom_title")}
        disabled={qrFailed}
      >
        {qrFailed ? (
          <div className="flex h-[220px] w-[220px] flex-col items-center justify-center bg-muted text-muted-foreground rounded-md">
            <QrCode className="h-10 w-10 mb-2" />
            <span className="text-xs text-center px-2">
              {t("support.qr_load_failed")}
            </span>
          </div>
        ) : (
          <img
            src={BANK_QR_URL}
            alt={t("support.qr_alt")}
            width={220}
            height={220}
            loading="lazy"
            onError={() => setQrFailed(true)}
          />
        )}
      </button>

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
    </div>
  );
}
