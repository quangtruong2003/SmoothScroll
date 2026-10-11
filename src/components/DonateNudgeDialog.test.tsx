// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({ open: vi.fn() }));

vi.mock("@tauri-apps/plugin-shell", () => ({ open: mocks.open }));

const STRINGS: Record<string, string> = {
  "support.nudge_title": "Cảm ơn bạn đã dùng SmoothScroll",
  "support.nudge_body_milestone":
    "SmoothScroll do mình viết và duy trì một mình — không quảng cáo, không thu phí.",
  "support.nudge_body_update": "Bạn vừa cập nhật lên bản {{version}}. Cảm ơn đã đồng hành.",
  "support.buy_me_a_coffee": "Mua cho mình một ly café",
  "support.bank_vietnam": "Ngân hàng Việt Nam",
  "support.nudge_later": "Để sau",
  "support.nudge_never": "Đừng nhắc nữa",
  "support.qr_alt": "VietQR",
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

import { BANK_QR_URL, BMC_URL } from "@/lib/donate";
import { DonateNudgeDialog } from "./DonateNudgeDialog";

beforeEach(() => {
  mocks.open.mockReset();
  mocks.open.mockResolvedValue(undefined);
});

describe("DonateNudgeDialog", () => {
  it("renders nothing while closed", () => {
    render(
      <DonateNudgeDialog
        open={false}
        reason="milestone"
        onClose={() => {}}
        onMuteForever={() => {}}
      />,
    );
    expect(screen.queryByText("Cảm ơn bạn đã dùng SmoothScroll")).toBeNull();
  });

  it("shows the milestone copy", () => {
    render(
      <DonateNudgeDialog
        open
        reason="milestone"
        onClose={() => {}}
        onMuteForever={() => {}}
      />,
    );
    expect(
      screen.getByText("SmoothScroll do mình viết và duy trì một mình — không quảng cáo, không thu phí."),
    ).toBeTruthy();
  });

  it("shows the update copy with the new version", () => {
    render(
      <DonateNudgeDialog
        open
        reason="update"
        version="1.36.0"
        onClose={() => {}}
        onMuteForever={() => {}}
      />,
    );
    expect(
      screen.getByText("Bạn vừa cập nhật lên bản 1.36.0. Cảm ơn đã đồng hành."),
    ).toBeTruthy();
  });

  it("opens Buy Me a Coffee in the browser", async () => {
    const user = userEvent.setup();
    render(
      <DonateNudgeDialog
        open
        reason="milestone"
        onClose={() => {}}
        onMuteForever={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Mua cho mình một ly café" }));
    expect(mocks.open).toHaveBeenCalledWith(BMC_URL);
  });

  it("offers the Vietnamese bank QR as the fallback path", async () => {
    const user = userEvent.setup();
    render(
      <DonateNudgeDialog
        open
        reason="milestone"
        onClose={() => {}}
        onMuteForever={() => {}}
      />,
    );

    expect(screen.queryByAltText("VietQR")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Ngân hàng Việt Nam" }));

    const img = screen.getByAltText("VietQR");
    expect(img.getAttribute("src")).toBe(BANK_QR_URL);
  });

  it("starts the cooldown when the user defers", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <DonateNudgeDialog open reason="milestone" onClose={onClose} onMuteForever={() => {}} />,
    );

    await user.click(screen.getByRole("button", { name: "Để sau" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("permanently silences the nudge on request", async () => {
    const onMuteForever = vi.fn();
    const user = userEvent.setup();
    render(
      <DonateNudgeDialog
        open
        reason="milestone"
        onClose={() => {}}
        onMuteForever={onMuteForever}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Đừng nhắc nữa" }));
    expect(onMuteForever).toHaveBeenCalledTimes(1);
  });
});
