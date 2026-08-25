import crypto from "node:crypto";

// Tiền tố để dễ nhận ra giao dịch nạp credit giữa hàng loạt giao dịch khác trong cùng
// tài khoản ngân hàng, và để lọc bớt false-positive khi so khớp nội dung chuyển khoản.
const REFERENCE_PREFIX = "HIFENCREDIT";

// Mã tham chiếu ngắn, không dấu, không khoảng trắng — nội dung chuyển khoản ngân hàng
// Việt Nam thường bị ngân hàng cắt bớt/chuẩn hoá nên tránh ký tự đặc biệt.
export function generateTopUpReferenceCode(): string {
  const random = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `${REFERENCE_PREFIX}${random}`;
}

export function buildTopUpQrUrl(amount: number, referenceCode: string): string | null {
  const acc = process.env.SEPAY_BANK_ACCOUNT;
  const bank = process.env.SEPAY_BANK_CODE;
  if (!acc || !bank) return null;

  const params = new URLSearchParams({
    acc,
    bank,
    amount: String(amount),
    des: referenceCode,
    template: "compact",
  });
  const holder = process.env.SEPAY_ACCOUNT_HOLDER;
  if (holder) params.set("holder", holder);

  return `https://vietqr.app/img?${params.toString()}`;
}

export type SepayWebhookPayload = {
  gateway?: string;
  transactionDate?: string;
  accountNumber?: string;
  subAccount?: string | null;
  transferType?: "in" | "out";
  transferAmount?: number;
  accumulated?: number;
  code?: string | null;
  content?: string;
  referenceCode?: string;
  description?: string;
};

// SePay hỗ trợ cấu hình xác thực webhook kiểu "API Key" gửi lại trong header
// Authorization — tài liệu SePay không nêu rõ tuyệt đối là "Apikey" hay "Bearer" nên
// chấp nhận cả 2 dạng để không bị kẹt vì lệch quy ước.
export function isValidSepayWebhookAuth(authorizationHeader: string | null): boolean {
  const expected = process.env.SEPAY_WEBHOOK_API_KEY;
  if (!expected) return false;
  if (!authorizationHeader) return false;

  const token = authorizationHeader.replace(/^(Apikey|Bearer)\s+/i, "").trim();
  return token === expected;
}

// Nội dung chuyển khoản ngân hàng thật thường bị ngân hàng thêm tiền tố/hậu tố (tên
// người gửi, mã giao dịch nội bộ...) nên so khớp bằng "chứa" thay vì so khớp tuyệt đối.
export function contentContainsReferenceCode(content: string, referenceCode: string): boolean {
  return content.toUpperCase().replace(/\s+/g, "").includes(referenceCode.toUpperCase());
}
