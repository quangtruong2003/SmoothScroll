export const BMC_URL = "https://buymeacoffee.com/quangtruong2003";
export const BANK_CODE = "BVBank";
export const BANK_ACCOUNT = "0947890450";
export const BANK_HOLDER = "NGUYEN QUANG TRUONG";
export const BANK_DISPLAY_NAME = "Timo (BVBank)";

export interface VietQRParams {
  bankCode: string;
  account: string;
  holder: string;
}

export function buildVietQRUrl({ bankCode, account, holder }: VietQRParams): string {
  const name = encodeURIComponent(holder);
  return `https://img.vietqr.io/image/${bankCode}-${account}-compact2.png?accountName=${name}`;
}

export const BANK_QR_URL = buildVietQRUrl({
  bankCode: BANK_CODE,
  account: BANK_ACCOUNT,
  holder: BANK_HOLDER,
});
