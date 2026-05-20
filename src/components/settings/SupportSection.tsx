import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Coffee, QrCode } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { BANK_QR_URL } from "@/lib/donate";

export function SupportSection() {
  const { t } = useTranslation();
  const [zoomOpen, setZoomOpen] = useState(false);
  const [qrFailed, setQrFailed] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coffee className="h-4 w-4" />
          {t("support.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Button className="w-full gap-2" onClick={() => setZoomOpen(true)}>
          <QrCode className="h-4 w-4" />
          {t("support.donate_button")}
        </Button>

        <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
          <DialogContent className="max-w-md p-4">
            <DialogTitle className="sr-only">
              {t("support.qr_zoom_title")}
            </DialogTitle>
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
                  src={BANK_QR_URL}
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
