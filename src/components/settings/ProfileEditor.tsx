import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SettingRow } from "./SettingRow";
import { useSettingsStore } from "@/stores/settingsStore";
import { toast } from "@/components/ui/toast";
import type { ScrollProfile, EasingMode } from "@/lib/tauri";

interface Props {
  profile: ScrollProfile;
  onClose: () => void;
}

export function ProfileEditor({ profile, onClose }: Props) {
  const { t } = useTranslation();
  const updateProfile = useSettingsStore((s) => s.updateProfile);
  const [draft, setDraft] = useState<ScrollProfile>(profile);
  const [saving, setSaving] = useState(false);

  const patch = (p: Partial<ScrollProfile>) => setDraft((d) => ({ ...d, ...p }));

  const handleSave = async () => {
    const name = draft.name.trim();
    if (!name) {
      toast.error(t("profiles.name_required"));
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ ...draft, name });
      toast.success(t("profiles.saved", { name }));
      onClose();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t("profiles.edit_title", { name: profile.name })}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-1 divide-y">
            <SettingRow
              htmlFor="profile-name"
              title={t("profiles.field.name")}
              description={t("profiles.field.name_desc")}
            >
              <Input
                id="profile-name"
                className="w-48"
                value={draft.name}
                onChange={(e) => patch({ name: e.target.value })}
              />
            </SettingRow>

            <SettingRow
              htmlFor="profile-step-size"
              title={t("settings.step_size.title")}
              description={t("settings.step_size.desc")}
              trailing={`${draft.step_size_px}px`}
            >
              <Slider
                id="profile-step-size"
                value={[draft.step_size_px]}
                min={10}
                max={500}
                step={5}
                className="w-48"
                onValueChange={([v]) => patch({ step_size_px: v })}
              />
            </SettingRow>

            <SettingRow
              htmlFor="profile-anim-time"
              title={t("settings.anim_time.title")}
              description={t("settings.anim_time.desc")}
              trailing={`${draft.animation_time_ms}ms`}
            >
              <Slider
                id="profile-anim-time"
                value={[draft.animation_time_ms]}
                min={50}
                max={1500}
                step={10}
                className="w-48"
                onValueChange={([v]) => patch({ animation_time_ms: v })}
              />
            </SettingRow>

            <SettingRow
              htmlFor="profile-accel-delta"
              title={t("settings.accel_window.title")}
              description={t("settings.accel_window.desc")}
              trailing={`${draft.acceleration_delta_ms}ms`}
            >
              <Slider
                id="profile-accel-delta"
                value={[draft.acceleration_delta_ms]}
                min={0}
                max={300}
                step={5}
                className="w-48"
                onValueChange={([v]) => patch({ acceleration_delta_ms: v })}
              />
            </SettingRow>

            <SettingRow
              htmlFor="profile-accel-max"
              title={t("settings.accel_max.title")}
              description={t("settings.accel_max.desc")}
              trailing={`${draft.acceleration_max}x`}
            >
              <Slider
                id="profile-accel-max"
                value={[draft.acceleration_max]}
                min={1}
                max={20}
                step={1}
                className="w-48"
                onValueChange={([v]) => patch({ acceleration_max: v })}
              />
            </SettingRow>

            <SettingRow
              htmlFor="profile-tail-ratio"
              title={t("settings.tail_ratio.title")}
              description={t("settings.tail_ratio.desc")}
              trailing={`${draft.tail_to_head_ratio}`}
            >
              <Slider
                id="profile-tail-ratio"
                value={[draft.tail_to_head_ratio]}
                min={1}
                max={20}
                step={1}
                className="w-48"
                onValueChange={([v]) => patch({ tail_to_head_ratio: v })}
              />
            </SettingRow>

            <SettingRow
              htmlFor="profile-easing-toggle"
              title={t("settings.easing_toggle.title")}
              description={t("settings.easing_toggle.desc")}
            >
              <Switch
                id="profile-easing-toggle"
                checked={draft.animation_easing}
                onCheckedChange={(v) => patch({ animation_easing: v })}
              />
            </SettingRow>

            <SettingRow
              htmlFor="profile-easing-mode"
              title={t("settings.easing_curve.title")}
              description={t("settings.easing_curve.desc")}
            >
              <Select
                value={draft.easing_mode}
                onValueChange={(v) => patch({ easing_mode: v as EasingMode })}
              >
                <SelectTrigger id="profile-easing-mode" className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ExponentialOut">
                    {t("settings.easing_curve.ExponentialOut")}
                  </SelectItem>
                  <SelectItem value="CubicOut">
                    {t("settings.easing_curve.CubicOut")}
                  </SelectItem>
                  <SelectItem value="QuinticOut">
                    {t("settings.easing_curve.QuinticOut")}
                  </SelectItem>
                  <SelectItem value="Linear">
                    {t("settings.easing_curve.Linear")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </SettingRow>

            <SettingRow
              htmlFor="profile-reverse"
              title={t("settings.reverse_wheel.title")}
              description={t("settings.reverse_wheel.desc")}
            >
              <Switch
                id="profile-reverse"
                checked={draft.reverse_wheel_direction}
                onCheckedChange={(v) => patch({ reverse_wheel_direction: v })}
              />
            </SettingRow>

            <SettingRow
              htmlFor="profile-h-smooth"
              title={t("settings.horizontal_smoothness.title")}
              description={t("settings.horizontal_smoothness.desc")}
            >
              <Switch
                id="profile-h-smooth"
                checked={draft.horizontal_smoothness}
                onCheckedChange={(v) => patch({ horizontal_smoothness: v })}
              />
            </SettingRow>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
