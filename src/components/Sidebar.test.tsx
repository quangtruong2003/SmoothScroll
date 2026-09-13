// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AppSettings } from "@/lib/tauri";
import { useSettingsStore } from "@/stores/settingsStore";

const mocks = vi.hoisted(() => ({
  open: vi.fn(),
  isTrustedDevice: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-shell", () => ({
  open: mocks.open,
}));

vi.mock("@/lib/tauri", () => ({
  tauri: {
    appVersion: vi.fn().mockResolvedValue("0.0.0"),
    isTrustedDevice: mocks.isTrustedDevice,
  },
}));

import { BMC_URL } from "@/lib/donate";
import { Sidebar } from "./Sidebar";

const t = (key: string) => key;

const settings = { theme: "System", language: "en" } as AppSettings;

beforeEach(() => {
  mocks.open.mockReset();
  mocks.open.mockResolvedValue(undefined);
  mocks.isTrustedDevice.mockReset();
  mocks.isTrustedDevice.mockResolvedValue(false);
  useSettingsStore.setState({ settings, loading: false, error: null });
});

describe("Sidebar footer donate button", () => {
  it("renders the Buy Me a Coffee button above the theme switch", async () => {
    render(<Sidebar active="scroll" onChange={vi.fn()} t={t} />);
    await act(async () => {
      await Promise.resolve();
    });

    const bmc = screen.getByRole("button", { name: "support.buy_me_a_coffee" });
    expect(bmc.className).toContain("bg-[#FFDD00]");
    expect(bmc.className).toContain("text-black");
    const themeGroup = screen.getByRole("radiogroup", { name: "settings.theme.title" });
    expect(bmc.compareDocumentPosition(themeGroup) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("hides the Buy Me a Coffee button on trusted devices", async () => {
    mocks.isTrustedDevice.mockResolvedValue(true);
    render(<Sidebar active="scroll" onChange={vi.fn()} t={t} />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByRole("button", { name: "support.buy_me_a_coffee" })).toBeNull();
    expect(screen.getByRole("radiogroup", { name: "settings.theme.title" })).toBeTruthy();
  });

  it("opens the SmoothScroll Buy Me a Coffee page", async () => {
    const user = userEvent.setup();
    render(<Sidebar active="scroll" onChange={vi.fn()} t={t} />);

    await user.click(screen.getByRole("button", { name: "support.buy_me_a_coffee" }));

    expect(mocks.open).toHaveBeenCalledWith(BMC_URL);
  });
});
