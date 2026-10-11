import { useState } from "react";
import { useTranslation } from "react-i18next";
import { open as openUrl } from "@tauri-apps/plugin-shell";
import { Coffee, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QrImage } from "@/components/QrImage";
import { BANK_QR_URL, BMC_URL } from "@/lib/donate";
import type { NudgeReason } from "@/lib/donateNudge";

interface DonateNudgeDialogProps {
  open: boolean;
  reason: NudgeReason;
  /** Only meaningful for `reason === "update"`. */
  version?: string;
  /** Dismissed for now — applies the cooldown. */
  onClose: () => void;
  /** User asked to never be nudged again. */
  onMuteForever: () => void;
}

export function DonateNudgeDialog({
  open,
  reason,
  version,
  onClose,
  onMuteForever,
}: DonateNudgeDialogProps) {
  const { t } = useTranslation();
  const [showBankQr, setShowBankQr] = useState(false);

  const handleBuyMeACoffee = () => {
    void openUrl(BMC_URL).catch(() => {
      // Browser unavailable — the bank QR below stays reachable.
      setShowBankQr(true);
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("support.nudge_title")}</DialogTitle>
          <DialogDescription>
            {reason === "update"
              ? t("support.nudge_body_update", { version })
              : t("support.nudge_body_milestone")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            className="gap-2 bg-[#FFDD00] text-black hover:bg-[#FFDD00]/90"
            onClick={handleBuyMeACoffee}
          >
            <Coffee className="h-4 w-4" />
            {t("support.buy_me_a_coffee")}
          </Button>
          <Button className="gap-2" onClick={() => setShowBankQr(true)}>
            <QrCode className="h-4 w-4" />
            {t("support.bank_vietnam")}
          </Button>
        </div>

        {showBankQr && (
          <div className="flex justify-center">
            <QrImage src={BANK_QR_URL} />
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={onMuteForever}>
            {t("support.nudge_never")}
          </Button>
          <Button variant="outline" onClick={onClose}>
            {t("support.nudge_later")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
