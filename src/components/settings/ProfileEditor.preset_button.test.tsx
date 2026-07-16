// @vitest-environment jsdom
import * as matchers from "@testing-library/jest-dom/matchers";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ORDER, PRESETS } from "@/lib/scrollPresets";
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
  smooth_zoom: true,
  zoom_invert: false,
  zoom_sensitivity: 1,
};

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() { return undefined; }
    unobserve() { return undefined; }
    disconnect() { return undefined; }
  } as typeof ResizeObserver;
  HTMLElement.prototype.hasPointerCapture ??= () => false;
  HTMLElement.prototype.setPointerCapture ??= () => undefined;
  HTMLElement.prototype.releasePointerCapture ??= () => undefined;
});

beforeEach(() => {
  mocks.updateProfile.mockReset();
  mocks.updateProfile.mockResolvedValue(undefined);
});

describe("ProfileEditor preset popover", () => {
  it("focuses first preset chip inside editor dialog when opened", async () => {
    const user = userEvent.setup();
    render(<ProfileEditor profile={profile} onClose={vi.fn()} />);

    const editorDialog = screen.getByRole("dialog", { name: "profiles.edit_title" });
    await user.click(screen.getByRole("button", { name: "Apply preset…" }));

    const popover = screen.getByRole("dialog", { name: "Apply preset…" });
    expect(popover).toBeInTheDocument();
    expect(editorDialog).toContainElement(popover);
    await waitFor(() =>
      expect(
        within(popover).getByRole("button", { name: `presets.${ORDER[0]}` }),
      ).toHaveFocus(),
    );
  });

  it("saves only Mac-like preset fields from the popover", async () => {
    const user = userEvent.setup();
    render(<ProfileEditor profile={profile} onClose={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Apply preset…" }));

    const popover = screen.getByRole("dialog", { name: "Apply preset…" });
    await user.click(within(popover).getByRole("button", { name: "presets.mac_like" }));
    await user.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(mocks.updateProfile).toHaveBeenCalledTimes(1));
    const saved = mocks.updateProfile.mock.calls[0][0] as ScrollProfile;
    expect(saved).toEqual({ ...profile, ...PRESETS.mac_like });
    expect(
      Object.keys(saved).filter(
        (key) => saved[key as keyof ScrollProfile] !== profile[key as keyof ScrollProfile],
      ),
    ).toEqual(["step_size_px", "animation_time_ms", "max_velocity", "acceleration_max"]);
  });

  it("saves edited profile zoom settings", async () => {
    const user = userEvent.setup();
    render(<ProfileEditor profile={profile} onClose={vi.fn()} />);

    await user.click(document.getElementById("profile-smooth-zoom")!);
    await user.click(document.getElementById("profile-zoom-invert")!);
    const sensitivity = screen.getByRole("slider", {
      name: "settings.zoom_sensitivity.title",
    });
    await user.click(sensitivity);
    await user.keyboard("{End}");
    await user.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(mocks.updateProfile).toHaveBeenCalledTimes(1));
    expect(mocks.updateProfile).toHaveBeenCalledWith({
      ...profile,
      smooth_zoom: false,
      zoom_invert: true,
      zoom_sensitivity: 4,
    });
  });
});
