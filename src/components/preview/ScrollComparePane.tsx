import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { AppSettings } from "@/lib/tauri";
import { useWasmEngine } from "./useWasmEngine";
import { ScrollPreviewArea } from "./ScrollPreviewArea";
import { SamplePreviewContent } from "./sampleContent";
import { Button } from "@/components/ui/button";

interface Props {
  settingsA: AppSettings;
  settingsB: AppSettings;
  onApplyB: () => void;
  onSwap: () => void;
}

/**
 * Side-by-side scroll comparison. Hover gates which pane receives wheel input
 * so user can A/B-feel the same content under two settings without saving.
 */
export function ScrollComparePane({
  settingsA,
  settingsB,
  onApplyB,
  onSwap,
}: Props) {
  const { t } = useTranslation();
  const engineA = useWasmEngine(settingsA);
  const engineB = useWasmEngine(settingsB);
  const [active, setActive] = useState<"A" | "B">("A");

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div onMouseEnter={() => setActive("A")}>
          <div className="mb-1 text-xs text-muted-foreground">
            {t("compare.a_label")}
          </div>
          <ScrollPreviewArea engine={engineA} active={active === "A"}>
            <SamplePreviewContent />
          </ScrollPreviewArea>
        </div>
        <div onMouseEnter={() => setActive("B")}>
          <div className="mb-1 text-xs text-muted-foreground">
            {t("compare.b_label")}
          </div>
          <ScrollPreviewArea engine={engineB} active={active === "B"}>
            <SamplePreviewContent />
          </ScrollPreviewArea>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button variant="outline" size="sm" onClick={onSwap}>
          {t("compare.swap")}
        </Button>
        <Button size="sm" onClick={onApplyB}>
          {t("compare.apply_b")}
        </Button>
      </div>
    </div>
  );
}
