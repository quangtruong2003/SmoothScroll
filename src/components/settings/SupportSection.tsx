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

        <Button className="w-full gap-2" onClick={() => void open(BMC_URL)}>
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
              className="shrink-0 rounded-md overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-default"
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
