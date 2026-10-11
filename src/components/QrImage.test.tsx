// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        "support.qr_load_failed": "Không tải được mã QR",
        "support.qr_alt": "VietQR",
      })[key] ?? key,
  }),
}));

import { QrImage } from "./QrImage";

describe("QrImage", () => {
  it("renders the QR with an accessible label", () => {
    render(<QrImage src="https://example.test/qr.png" />);

    const img = screen.getByAltText("VietQR");
    expect(img.getAttribute("src")).toBe("https://example.test/qr.png");
  });

  it("swaps to a placeholder when the image fails to load", () => {
    render(<QrImage src="https://example.test/qr.png" />);

    fireEvent.error(screen.getByAltText("VietQR"));

    expect(screen.queryByAltText("VietQR")).toBeNull();
    expect(screen.getByText("Không tải được mã QR")).toBeTruthy();
  });
});
