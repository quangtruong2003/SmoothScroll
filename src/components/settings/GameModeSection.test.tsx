/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

beforeAll(() => {
  (globalThis as any).ResizeObserver =
    (globalThis as any).ResizeObserver ??
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
});

const h = vi.hoisted(() => ({ knownApps: ["GTA5.exe"] as string[] }));

const mockGetKnownGameIcons = vi.fn().mockResolvedValue({});
const mockGetGameCatalog = vi.fn();
const mockAddKnownGame = vi.fn().mockResolvedValue(null);
const mockRemoveKnownGame = vi.fn().mockResolvedValue(null);
const mockPatch = vi.fn();

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

vi.mock("@/lib/platform", () => ({ IS_LINUX: false }));

vi.mock("@/lib/gameIcons", () => ({
  gameIconFor: (name: string) => {
    const n = name.toLowerCase();
    if (n.startsWith("gta5")) return "/bundled/gta5.png";
    if (n.startsWith("witcher3")) return "/bundled/witcher3.png";
    return null;
  },
}));

vi.mock("@/lib/tauri", () => ({
  tauri: {
    getGameModeStatus: vi.fn().mockResolvedValue(false),
    getKnownGameIcons: (names: string[]) => mockGetKnownGameIcons(names),
    getGameCatalog: () => mockGetGameCatalog(),
    addKnownGame: (name: string) => mockAddKnownGame(name),
    removeKnownGame: (name: string) => mockRemoveKnownGame(name),
  },
}));

vi.mock("@/stores/settingsStore", () => ({
  useSettingsStore: (selector: any) => selector({ patch: mockPatch }),
  useGameModeFields: () => ({
    game_mode_enabled: true,
    game_mode_known_apps: h.knownApps,
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { GameModeSection } from "@/components/settings/GameModeSection";

beforeEach(() => {
  vi.clearAllMocks();
  mockGetKnownGameIcons.mockResolvedValue({});
  mockAddKnownGame.mockResolvedValue(null);
  h.knownApps = ["GTA5.exe"];
});

afterEach(() => {
  h.knownApps = ["GTA5.exe"];
});

describe("GameModeSection", () => {
  it("renders chips with a bundled icon when available", () => {
    const { container } = render(<GameModeSection />);
    expect(screen.getByText("GTA5.exe")).toBeTruthy();
    expect(container.querySelector('img[src="/bundled/gta5.png"]')).toBeTruthy();
  });

  it("requests backend icons only for non-bundled games and renders them", async () => {
    h.knownApps = ["GTA5.exe", "Hades.exe"];
    mockGetKnownGameIcons.mockResolvedValue({ "Hades.exe": "aGFkZXM=" });
    const { container } = render(<GameModeSection />);
    await waitFor(() =>
      expect(mockGetKnownGameIcons).toHaveBeenCalledWith(["Hades.exe"]),
    );
    await waitFor(() =>
      expect(
        container.querySelector('img[src="data:image/png;base64,aGFkZXM="]'),
      ).toBeTruthy(),
    );
  });

  it("shows the fallback gamepad icon for a known game without any icon", async () => {
    h.knownApps = ["Hades.exe"];
    mockGetKnownGameIcons.mockResolvedValue({ "Hades.exe": null });
    render(<GameModeSection />);
    await waitFor(() => expect(screen.getByText("Hades.exe")).toBeTruthy());
    const chip = screen.getByText("Hades.exe").closest("span");
    expect(chip?.querySelector("img")).toBeNull();
    expect(chip?.querySelector("svg")).toBeTruthy();
  });

  it("opens the picker on click, lists catalog games, and hides known ones", async () => {
    mockGetGameCatalog.mockResolvedValue([
      { exe_name: "Hades.exe", display_name: "Hades" },
      { exe_name: "GTA5.exe", display_name: "Grand Theft Auto V" },
    ]);
    render(<GameModeSection />);
    fireEvent.click(screen.getByPlaceholderText("game_mode.search_placeholder"));
    const list = await screen.findByTestId("game-picker-list");
    await within(list).findByText("Hades.exe");
    expect(within(list).queryByText("GTA5.exe")).toBeNull();
    // Known games are hidden entirely — the display name of a known entry
    // must not leak into the picker either.
    expect(within(list).queryByText("Grand Theft Auto V")).toBeNull();
  });

  it("filters by exe name and display name", async () => {
    mockGetGameCatalog.mockResolvedValue([
      { exe_name: "Hades.exe", display_name: "Hades" },
      { exe_name: "Terraria.exe", display_name: null },
    ]);
    render(<GameModeSection />);
    const input = screen.getByPlaceholderText("game_mode.search_placeholder");
    fireEvent.click(input);
    const list = await screen.findByTestId("game-picker-list");
    await within(list).findByText("Hades.exe");

    fireEvent.change(input, { target: { value: "had" } });
    expect(within(list).queryByText("Terraria.exe")).toBeNull();
    expect(within(list).getByText("Hades.exe")).toBeTruthy();

    fireEvent.change(input, { target: { value: "terr" } });
    expect(within(list).queryByText("Hades.exe")).toBeNull();
    expect(within(list).getByText("Terraria.exe")).toBeTruthy();
  });

  it("adds a game on click through addKnownGame and patches the store", async () => {
    mockGetGameCatalog.mockResolvedValue([
      { exe_name: "Hades.exe", display_name: "Hades" },
    ]);
    render(<GameModeSection />);
    fireEvent.click(screen.getByPlaceholderText("game_mode.search_placeholder"));
    const list = await screen.findByTestId("game-picker-list");
    fireEvent.click(await within(list).findByText("Hades.exe"));
    await waitFor(() => expect(mockAddKnownGame).toHaveBeenCalledWith("Hades.exe"));
    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith({
        game_mode_known_apps: ["GTA5.exe", "Hades.exe"],
      }),
    );
  });

  it("adds a manual exe name on Enter", async () => {
    render(<GameModeSection />);
    const input = screen.getByPlaceholderText("game_mode.search_placeholder");
    fireEvent.change(input, { target: { value: "mygame.exe" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(mockAddKnownGame).toHaveBeenCalledWith("mygame.exe"));
    expect(mockPatch).toHaveBeenCalledWith({
      game_mode_known_apps: ["GTA5.exe", "mygame.exe"],
    });
  });

  it("blocks case-insensitive duplicates", async () => {
    render(<GameModeSection />);
    const input = screen.getByPlaceholderText("game_mode.search_placeholder");
    fireEvent.change(input, { target: { value: "gta5.EXE" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(mockAddKnownGame).not.toHaveBeenCalled());
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it("degrades to the empty state when the catalog fetch fails", async () => {
    mockGetGameCatalog.mockRejectedValue(new Error("scan failed"));
    render(<GameModeSection />);
    fireEvent.click(screen.getByPlaceholderText("game_mode.search_placeholder"));
    expect(await screen.findByText("game_mode.empty_state")).toBeTruthy();
  });

  it("bulk-fetches icons for picker entries, skipping bundled ones", async () => {
    mockGetGameCatalog.mockResolvedValue([
      { exe_name: "Hades.exe", display_name: "Hades" },
      { exe_name: "witcher3.exe", display_name: "The Witcher 3" },
    ]);
    mockGetKnownGameIcons.mockResolvedValue({ "Hades.exe": "aGFkZXM=" });
    render(<GameModeSection />);
    fireEvent.click(screen.getByPlaceholderText("game_mode.search_placeholder"));
    const list = await screen.findByTestId("game-picker-list");
    await within(list).findByText("Hades.exe");

    // Only the non-bundled entry is requested (known games are bundled here,
    // so the mount effect has nothing to fetch — this call is the picker's).
    await waitFor(() =>
      expect(mockGetKnownGameIcons).toHaveBeenCalledWith(["Hades.exe"]),
    );
    expect(mockGetKnownGameIcons.mock.calls[0][0]).not.toContain("witcher3.exe");

    // The fetched icon lands in the row; the bundled one renders from assets.
    await waitFor(() =>
      expect(
        within(list)
          .getByText("Hades.exe")
          .closest("button")
          ?.querySelector('img[src="data:image/png;base64,aGFkZXM="]'),
      ).toBeTruthy(),
    );
    expect(
      within(list)
        .getByText("witcher3.exe")
        .closest("button")
        ?.querySelector('img[src="/bundled/witcher3.png"]'),
    ).toBeTruthy();
  });
});
