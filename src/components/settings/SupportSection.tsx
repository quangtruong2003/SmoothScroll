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
import { QrImage } from "@/components/QrImage";
import bmcQrUrl from "@/assets/donate/bmc-qr.png";
import { BANK_QR_URL, BMC_URL } from "@/lib/donate";

type QrDialog = "bmc" | "bank";

export function SupportSection() {
  const { t } = useTranslation();
  const [qrDialog, setQrDialog] = useState<QrDialog | null>(null);

  const showQr = (kind: QrDialog) => {
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
            {t("support.buy_me_a_coffee")}
          </Button>
          <Button className="gap-2" onClick={() => showQr("bank")}>
            <QrCode className="h-4 w-4" />
            {t("support.bank_vietnam")}
          </Button>
        </div>

        <Dialog open={qrDialog !== null} onOpenChange={handleDialogChange}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t("support.qr_zoom_title")}</DialogTitle>
            </DialogHeader>
            <div className="flex justify-center">
              {/* key: failure state is internal to QrImage, so a src change
                  must remount or the placeholder would stick forever. */}
              <QrImage key={qrUrl} src={qrUrl} />
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
