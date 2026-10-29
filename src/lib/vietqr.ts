// CR-068: VietQR dynamic QR - tao anh QR chuyen khoan free qua
// img.vietqr.io (chuan NAPAS) - khong can API key.
// Bank code theo danh muc ngan hang NAPAS (BIN code dang text).
export const VIETQR_BANKS = [
  { code: "VCB", name: "Vietcombank" },
  { code: "BIDV", name: "BIDV" },
  { code: "ICB", name: "VietinBank" },
  { code: "VBA", name: "Agribank" },
  { code: "TCB", name: "Techcombank" },
  { code: "MB", name: "MB Bank" },
  { code: "ACB", name: "ACB" },
  { code: "VPB", name: "VPBank" },
  { code: "TPB", name: "TPBank" },
  { code: "STB", name: "Sacombank" },
  { code: "VIB", name: "VIB" },
  { code: "HDB", name: "HDBank" },
  { code: "MSB", name: "MSB" },
  { code: "OCB", name: "OCB" },
  { code: "SHB", name: "SHB" },
  { code: "EIB", name: "Eximbank" },
  { code: "SEAB", name: "SeABank" },
  { code: "NAB", name: "Nam A Bank" },
  { code: "PGB", name: "PGBank" },
  { code: "VIETBANK", name: "VietBank" },
] as const;

export function vietQrUrl(input: {
  bankCode: string;
  accountNumber: string;
  accountName?: string;
  amount?: number;
  addInfo?: string;
}): string {
  const base = `https://img.vietqr.io/image/${input.bankCode}-${input.accountNumber}-compact2.png`;
  const params = new URLSearchParams();
  if (input.amount && input.amount > 0) params.set("amount", String(Math.round(input.amount)));
  if (input.addInfo) params.set("addInfo", input.addInfo);
  if (input.accountName) params.set("accountName", input.accountName);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}
