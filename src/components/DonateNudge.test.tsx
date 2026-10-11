// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({
  isTrustedDevice: vi.fn(),
  appVersion: vi.fn(),
}));

vi.mock("@/lib/tauri", () => ({
  tauri: {
    isTrustedDevice: mocks.isTrustedDevice,
    appVersion: mocks.appVersion,
  },
}));

const STRINGS: Record<string, string> = {
  "support.nudge_title": "Cảm ơn bạn đã dùng SmoothScroll",
  "support.nudge_body_milestone": "SmoothScroll do mình viết và duy trì một mình.",
  "support.nudge_body_update": "Bạn vừa cập nhật lên bản {{version}}.",
  "support.nudge_later": "Để sau",
  "support.nudge_never": "Đừng nhắc nữa",
};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      (STRINGS[key] ?? key).replace(
        /\{\{(\w+)\}\}/g,
        (_m, name: string) => String(opts?.[name] ?? ""),
      ),
  }),
}));

import { DonateNudge } from "./DonateNudge";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.now();

function seedStats(daysOld: number, sessionCount: number) {
  localStorage.setItem(
    "ss.stats.v1",
    JSON.stringify({
      totalScrolls: 0,
      sessionCount,
      firstSeenAt: NOW - daysOld * DAY_MS,
      lastSeenAt: NOW,
    }),
  );
}

beforeEach(() => {
  localStorage.clear();
  mocks.isTrustedDevice.mockResolvedValue(false);
  mocks.appVersion.mockResolvedValue("1.35.1");
});

describe("DonateNudge", () => {
  it("stays silent on the developer's own machine", async () => {
    mocks.isTrustedDevice.mockResolvedValue(true);
    seedStats(400, 999);

    render(<DonateNudge />);

    await waitFor(() => expect(mocks.appVersion).toHaveBeenCalled());
    expect(screen.queryByText("Cảm ơn bạn đã dùng SmoothScroll")).toBeNull();
  });

  it("stays silent for a brand-new user", async () => {
    seedStats(1, 2);

    render(<DonateNudge />);

    await waitFor(() => expect(mocks.appVersion).toHaveBeenCalled());
    expect(screen.queryByText("Cảm ơn bạn đã dùng SmoothScroll")).toBeNull();
  });

  it("nudges once the usage milestone is reached", async () => {
    seedStats(40, 120);

    render(<DonateNudge />);

    expect(await screen.findByText("Cảm ơn bạn đã dùng SmoothScroll")).toBeTruthy();
  });

  it("nudges right after an update, quoting the new version", async () => {
    localStorage.setItem("ss.lastVersion.v1", "1.35.1");
    mocks.appVersion.mockResolvedValue("1.36.0");
    seedStats(1, 2);

    render(<DonateNudge />);

    expect(await screen.findByText("Bạn vừa cập nhật lên bản 1.36.0.")).toBeTruthy();
  });

  it("does not repeat itself after the cooldown was armed", async () => {
    seedStats(40, 120);
    localStorage.setItem(
      "ss.donateNudge.v1",
      JSON.stringify({ lastNudgeAt: Date.now(), mutedForever: false }),
    );

    render(<DonateNudge />);

    await waitFor(() => expect(mocks.appVersion).toHaveBeenCalled());
    expect(screen.queryByText("Cảm ơn bạn đã dùng SmoothScroll")).toBeNull();
  });

  it("arms the cooldown when the user picks Later", async () => {
    const user = userEvent.setup();
    seedStats(40, 120);

    render(<DonateNudge />);

    await user.click(await screen.findByRole("button", { name: "Để sau" }));

    const stored = JSON.parse(localStorage.getItem("ss.donateNudge.v1") ?? "null");
    expect(stored.lastNudgeAt).toBeTypeOf("number");
    expect(stored.mutedForever).toBe(false);
    expect(screen.queryByText("Cảm ơn bạn đã dùng SmoothScroll")).toBeNull();
  });

  it("persists a permanent opt-out when the user picks Don't ask again", async () => {
    const user = userEvent.setup();
    seedStats(40, 120);

    render(<DonateNudge />);

    await user.click(await screen.findByRole("button", { name: "Đừng nhắc nữa" }));

    const stored = JSON.parse(localStorage.getItem("ss.donateNudge.v1") ?? "null");
    expect(stored.mutedForever).toBe(true);
  });

  it("stays quiet when the choice could not be remembered", async () => {
    seedStats(40, 120);

    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    try {
      render(<DonateNudge />);
      await waitFor(() => expect(mocks.appVersion).toHaveBeenCalled());
      expect(screen.queryByText("Cảm ơn bạn đã dùng SmoothScroll")).toBeNull();
    } finally {
      Storage.prototype.setItem = original;
    }
  });

  it("lets WhatsNew own the first moments after an update", async () => {
    localStorage.setItem("ss.lastVersion.v1", "1.35.1");
    mocks.appVersion.mockResolvedValue("1.36.0");
    seedStats(1, 2);

    const overlay = document.createElement("div");
    overlay.setAttribute("data-whatsnew", "");
    document.body.appendChild(overlay);

    try {
      render(<DonateNudge />);
      await waitFor(() => expect(mocks.appVersion).toHaveBeenCalled());
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(screen.queryByText("Cảm ơn bạn đã dùng SmoothScroll")).toBeNull();

      overlay.remove();
      expect(
        await screen.findByText("Bạn vừa cập nhật lên bản 1.36.0."),
      ).toBeTruthy();
    } finally {
      overlay.remove();
    }
  });
});
