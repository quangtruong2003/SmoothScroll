import { describe, expect, it } from "vitest";
import {
  BANK_ACCOUNT,
  BANK_CODE,
  BANK_DISPLAY_NAME,
  BANK_HOLDER,
  BMC_URL,
  buildVietQRUrl,
} from "./donate";

describe("donate constants", () => {
  it("exposes the BMC profile URL", () => {
    expect(BMC_URL).toBe("https://buymeacoffee.com/quangtruong2003");
  });

  it("uses Timo's VietQR BIN (970454) — shortName BVBank returns non-image", () => {
    expect(BANK_CODE).toBe("970454");
    expect(BANK_DISPLAY_NAME).toBe("Timo (BVBank)");
  });

  it("exposes the account number and holder", () => {
    expect(BANK_ACCOUNT).toBe("0947890450");
    expect(BANK_HOLDER).toBe("NGUYEN QUANG TRUONG");
  });
});

describe("buildVietQRUrl", () => {
  it("builds a qr_only VietQR URL with encoded account name", () => {
    const url = buildVietQRUrl({
      bankCode: "970454",
      account: "0947890450",
      holder: "NGUYEN QUANG TRUONG",
    });
    expect(url).toBe(
      "https://img.vietqr.io/image/970454-0947890450-qr_only.png?accountName=NGUYEN%20QUANG%20TRUONG",
    );
  });

  it("URL-encodes special characters in the holder name", () => {
    const url = buildVietQRUrl({
      bankCode: "970454",
      account: "0947890450",
      holder: "A & B",
    });
    expect(url).toContain("accountName=A%20%26%20B");
  });
});
