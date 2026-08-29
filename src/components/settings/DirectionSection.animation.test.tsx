// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({
  patch: vi.fn(),
  fields: {
    animation_time_enabled: false,
    reverse_wheel_direction: false,
    horizontal_smoothness: false,
    horizontal_invert: false,
    smooth_zoom: true,
    zoom_invert: false,
  },
}));

vi.mock("@/stores/settingsStore", () => ({
  useSettingsStore: (selector: (store: typeof mocks) => unknown) => selector(mocks),
  useDirectionFields: () => mocks.fields,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { DirectionSection } from "./DirectionSection";

beforeEach(() => {
  mocks.patch.mockReset();
  mocks.fields.animation_time_enabled = false;
});

describe("DirectionSection animation toggle", () => {
  it("shows Animation time off by default and enables it through the settings patch", async () => {
    const user = userEvent.setup();
    render(<DirectionSection />);

    const toggle = screen.getByRole("switch", { name: "settings.anim_time.title" });
    expect(toggle.getAttribute("aria-checked")).toBe("false");

    await user.click(toggle);
    expect(mocks.patch).toHaveBeenCalledWith({ animation_time_enabled: true });
  });
});
