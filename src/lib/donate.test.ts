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

  it("uses BVBank as the VietQR bank code (Timo runs on BVBank)", () => {
    expect(BANK_CODE).toBe("BVBank");
    expect(BANK_DISPLAY_NAME).toBe("Timo (BVBank)");
  });

  it("exposes the account number and holder", () => {
    expect(BANK_ACCOUNT).toBe("0947890450");
    expect(BANK_HOLDER).toBe("NGUYEN QUANG TRUONG");
  });
});

describe("buildVietQRUrl", () => {
  it("builds a compact2 VietQR URL with encoded account name", () => {
    const url = buildVietQRUrl({
      bankCode: "BVBank",
      account: "0947890450",
      holder: "NGUYEN QUANG TRUONG",
    });
    expect(url).toBe(
      "https://img.vietqr.io/image/BVBank-0947890450-compact2.png?accountName=NGUYEN%20QUANG%20TRUONG",
    );
  });

  it("URL-encodes special characters in the holder name", () => {
    const url = buildVietQRUrl({
      bankCode: "BVBank",
      account: "0947890450",
      holder: "A & B",
    });
    expect(url).toContain("accountName=A%20%26%20B");
  });
});
