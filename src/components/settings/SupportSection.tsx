import { useState } from "react";
import { useTranslation } from "react-i18next";
import { open } from "@tauri-apps/plugin-shell";
import { Coffee, QrCode } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import bmcQrUrl from "@/assets/donate/bmc-qr.png";
import { BANK_QR_URL, BMC_URL } from "@/lib/donate";

type QrDialog = "bmc" | "bank";

export function SupportSection() {
  const { t } = useTranslation();
  const [qrDialog, setQrDialog] = useState<QrDialog | null>(null);
  const [qrFailed, setQrFailed] = useState(false);

  const showQr = (kind: QrDialog) => {
    setQrFailed(false);
    setQrDialog(kind);
  };

  const handleBuyMeACoffee = async () => {
    try {
      await open(BMC_URL);
    } catch {
      showQr("bmc");
    }
  };

  const handleDialogChange = (open: boolean) => {
    if (!open) {
      setQrDialog(null);
      setQrFailed(false);
    }
  };

  const qrUrl = qrDialog === "bmc" ? bmcQrUrl : BANK_QR_URL;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coffee className="h-4 w-4" />
          {t("support.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            className="gap-2 bg-[#FFDD00] text-black hover:bg-[#FFDD00]/90"
            onClick={handleBuyMeACoffee}
          >
            <Coffee className="h-4 w-4" />
            Buy Me a Coffee
          </Button>
          <Button className="gap-2" onClick={() => showQr("bank")}>
            <QrCode className="h-4 w-4" />
            Bank Việt Nam
          </Button>
        </div>

        <Dialog open={qrDialog !== null} onOpenChange={handleDialogChange}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t("support.qr_zoom_title")}</DialogTitle>
            </DialogHeader>
            <div className="flex justify-center">
              {qrFailed ? (
                <div className="flex h-[320px] w-[320px] flex-col items-center justify-center bg-muted text-muted-foreground rounded-md">
                  <QrCode className="h-12 w-12 mb-2" />
                  <span className="text-sm text-center px-2">
                    {t("support.qr_load_failed")}
                  </span>
                </div>
              ) : (
                <img
                  src={qrUrl}
                  alt={t("support.qr_alt")}
                  width={480}
                  height={480}
                  className="rounded-md"
                  onError={() => setQrFailed(true)}
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
