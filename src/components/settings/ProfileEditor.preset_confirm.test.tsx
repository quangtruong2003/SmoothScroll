// @vitest-environment jsdom
import * as matchers from "@testing-library/jest-dom/matchers";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PRESETS } from "@/lib/scrollPresets";
import type { ScrollProfile } from "@/lib/tauri";

expect.extend(matchers);

const mocks = vi.hoisted(() => ({ updateProfile: vi.fn() }));

vi.mock("@/stores/settingsStore", () => ({
  useSettingsStore: (selector: (store: typeof mocks) => unknown) => selector(mocks),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key === "profiles.apply_preset" ? "Apply preset…" : key,
  }),
}));

import { ProfileEditor } from "./ProfileEditor";

const profile: ScrollProfile = {
  id: "profile-1",
  name: "Custom",
  step_size_px: 120,
  animation_time_ms: 50,
  max_velocity: 5,
  acceleration_max: 2,
  tail_to_head_ratio: 7,
  animation_easing: false,
  easing_mode: "Linear",
  reverse_wheel_direction: true,
  horizontal_smoothness: false,
};

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as typeof ResizeObserver;
  HTMLElement.prototype.hasPointerCapture ??= () => false;
  HTMLElement.prototype.setPointerCapture ??= () => undefined;
  HTMLElement.prototype.releasePointerCapture ??= () => undefined;
});

beforeEach(() => {
  mocks.updateProfile.mockReset();
  mocks.updateProfile.mockResolvedValue(undefined);
});

async function openDirtyPresetPopover(user: ReturnType<typeof userEvent.setup>) {
  const stepSlider = screen.getAllByRole("slider")[0];
  await user.click(stepSlider);
  await user.keyboard("{End}");
  expect(screen.getByText("500px")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Apply preset…" }));
  return screen.getByRole("dialog", { name: "Apply preset…" });
}

describe("ProfileEditor dirty preset confirmation", () => {
  it("keeps slider changes when preset replacement is cancelled", async () => {
    const user = userEvent.setup();
    render(<ProfileEditor profile={profile} onClose={vi.fn()} />);

    const popover = await openDirtyPresetPopover(user);
    await user.click(within(popover).getByRole("button", { name: "presets.snappy" }));

    expect(screen.getByText("profiles.apply_preset_confirm_title")).toBeInTheDocument();
    expect(screen.getByText("profiles.apply_preset_confirm_body")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "common.cancel" }));

    expect(screen.getByText("500px")).toBeInTheDocument();
    expect(mocks.updateProfile).not.toHaveBeenCalled();
  });

  it("replaces dirty values after confirmation and saves preset fields", async () => {
    const user = userEvent.setup();
    render(<ProfileEditor profile={profile} onClose={vi.fn()} />);

    const popover = await openDirtyPresetPopover(user);
    await user.click(within(popover).getByRole("button", { name: "presets.snappy" }));
    await user.click(screen.getByRole("button", { name: "profiles.apply_preset_confirm" }));
    await user.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(mocks.updateProfile).toHaveBeenCalledTimes(1));
    expect(mocks.updateProfile).toHaveBeenCalledWith({ ...profile, ...PRESETS.snappy });
  });
});
