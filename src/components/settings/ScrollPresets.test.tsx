// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PRESETS } from "@/lib/scrollPresets";
import type { AppSettings } from "@/lib/tauri";

const mocks = vi.hoisted(() => ({
  settings: null as AppSettings | null,
  patch: vi.fn(),
  saveNow: vi.fn(),
}));

vi.mock("@/stores/settingsStore", () => ({
  useSettingsStore: (selector: (store: typeof mocks) => unknown) => selector(mocks),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { ScrollPresets } from "./ScrollPresets";

beforeEach(() => {
  mocks.settings = {
    ...PRESETS.default,
    enabled: true,
  } as AppSettings;
  mocks.patch.mockReset();
  mocks.saveNow.mockReset();
  mocks.saveNow.mockResolvedValue(undefined);
});

describe("ScrollPresets", () => {
  it("persists a selected preset immediately", async () => {
    const user = userEvent.setup();
    render(<ScrollPresets />);

    await user.click(screen.getByRole("button", { name: "presets.fast" }));

    expect(mocks.patch).toHaveBeenCalledWith(PRESETS.fast);
    expect(mocks.saveNow).toHaveBeenCalledTimes(1);
    expect(mocks.patch.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.saveNow.mock.invocationCallOrder[0],
    );
  });
});
