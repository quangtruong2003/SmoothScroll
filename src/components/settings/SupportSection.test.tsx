// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({
  open: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-shell", () => ({
  open: mocks.open,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        "support.buy_me_a_coffee": "Buy Me a Coffee",
        "support.bank_vietnam": "Bank Việt Nam",
      })[key] ?? key,
  }),
}));

import { BANK_QR_URL, BMC_URL } from "@/lib/donate";
import { SupportSection } from "./SupportSection";

beforeEach(() => {
  mocks.open.mockReset();
  mocks.open.mockResolvedValue(undefined);
});

describe("SupportSection donate actions", () => {
  it("renders separate Buy Me a Coffee and Bank Việt Nam buttons", () => {
    render(<SupportSection />);

    const bmcButton = screen.getByRole("button", { name: "Buy Me a Coffee" });
    expect(bmcButton.className).toContain("bg-[#FFDD00]");
    expect(bmcButton.className).toContain("text-black");
    expect(screen.getByRole("button", { name: "Bank Việt Nam" })).toBeTruthy();
  });

  it("opens the SmoothScroll Buy Me a Coffee page", async () => {
    const user = userEvent.setup();
    render(<SupportSection />);

    await user.click(screen.getByRole("button", { name: "Buy Me a Coffee" }));

    expect(mocks.open).toHaveBeenCalledWith(BMC_URL);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("falls back to the bundled Buy Me a Coffee QR when opening the link fails", async () => {
    mocks.open.mockRejectedValueOnce(new Error("shell open failed"));
    const user = userEvent.setup();
    render(<SupportSection />);

    await user.click(screen.getByRole("button", { name: "Buy Me a Coffee" }));

    const qr = await screen.findByRole("img");
    expect(qr.getAttribute("src")).toContain("bmc-qr.png");
  });

  it("keeps Bank Việt Nam on the existing VietQR flow", async () => {
    const user = userEvent.setup();
    render(<SupportSection />);

    await user.click(screen.getByRole("button", { name: "Bank Việt Nam" }));

    const qr = await screen.findByRole("img");
    expect(qr.getAttribute("src")).toBe(BANK_QR_URL);
    expect(mocks.open).not.toHaveBeenCalled();
  });
});
