// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AppSettings } from "@/lib/tauri";
import { useSettingsStore } from "@/stores/settingsStore";

const mocks = vi.hoisted(() => ({
  saveDialog: vi.fn(),
  exportSettings: vi.fn(),
  saveSettings: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  save: mocks.saveDialog,
}));

vi.mock("@/lib/tauri", () => ({
  tauri: {
    exportSettings: mocks.exportSettings,
    saveSettings: mocks.saveSettings,
  },
}));

import { BackupSection } from "./BackupSection";

const settings = {
  step_size_px: 160,
  animation_time_ms: 280,
  max_velocity: 20,
  acceleration_max: 10,
  tail_to_head_ratio: 1,
  theme: "System",
  language: "en",
} as AppSettings;

beforeEach(() => {
  mocks.saveDialog.mockReset();
  mocks.exportSettings.mockReset();
  mocks.saveSettings.mockReset();
  mocks.exportSettings.mockImplementation((path: string) => Promise.resolve(path));
  mocks.saveSettings.mockResolvedValue(null);
  useSettingsStore.setState({
    settings,
    loading: false,
    error: null,
    load: vi.fn().mockResolvedValue(undefined),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("BackupSection export", () => {
  it("saves via the native Save dialog and reports the final path", async () => {
    const user = userEvent.setup();
    mocks.saveDialog.mockResolvedValue("C:\\backup\\my-settings");
    render(<BackupSection />);

    await user.click(screen.getByRole("button", { name: "backup.export" }));

    await waitFor(() => {
      expect(mocks.exportSettings).toHaveBeenCalledWith("C:\\backup\\my-settings");
    });
    expect(screen.getByText("backup.exported_to")).toBeTruthy();
  });

  it("does nothing when the Save dialog is cancelled", async () => {
    const user = userEvent.setup();
    mocks.saveDialog.mockResolvedValue(null);
    render(<BackupSection />);

    await user.click(screen.getByRole("button", { name: "backup.export" }));

    expect(mocks.exportSettings).not.toHaveBeenCalled();
    expect(screen.queryByText("backup.exported_to")).toBeNull();
  });

  it("shows an error when the export command fails", async () => {
    const user = userEvent.setup();
    mocks.saveDialog.mockResolvedValue("C:\\backup\\settings.json");
    mocks.exportSettings.mockRejectedValue(new Error("disk full"));
    render(<BackupSection />);

    await user.click(screen.getByRole("button", { name: "backup.export" }));

    await waitFor(() => {
      expect(screen.getByText("backup.export_error")).toBeTruthy();
    });
  });
});

describe("BackupSection import", () => {
  const importFile = async (content: string) => {
    const user = userEvent.setup();
    render(<BackupSection />);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File([content], "backup.json", { type: "application/json" }));
  };

  it("saves parsed settings after confirmation and reloads", async () => {
    await importFile(JSON.stringify(settings));

    await waitFor(() => {
      expect(mocks.saveSettings).toHaveBeenCalledWith(settings);
    });
    expect(screen.getByText("backup.imported")).toBeTruthy();
  });

  it("rejects files without the required settings keys", async () => {
    await importFile(JSON.stringify({ hello: "world" }));

    await waitFor(() => {
      expect(screen.getByText("backup.import_error")).toBeTruthy();
    });
    expect(mocks.saveSettings).not.toHaveBeenCalled();
  });

  it("does nothing when the confirmation is declined", async () => {
    const user = userEvent.setup();
    render(<BackupSection />);
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File([JSON.stringify(settings)], "backup.json"));

    expect(mocks.saveSettings).not.toHaveBeenCalled();
    expect(screen.queryByText("backup.imported")).toBeNull();
  });
});
