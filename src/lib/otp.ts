import crypto from "node:crypto";

export const OTP_EXPIRY_MINUTES = 10;
// Số lần nhập sai tối đa cho 1 mã OTP trước khi bắt buộc bấm "Gửi lại mã" — chống dò mã 6
// số bằng brute-force (1 triệu khả năng, nhưng rate-limit + khoá theo attempts khiến dò tay
// bất khả thi, không cần độ dài mã lớn hơn).
export const MAX_OTP_ATTEMPTS = 5;

// crypto.randomInt (CSPRNG) thay vì Math.random() — mã OTP là bí mật dùng để xác thực,
// không được đoán trước được dù chỉ 1 phần.
export function generateOtpCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

// Chỉ lưu hash trong DB — dữ liệu rò rỉ (backup lộ, log lỗi vô tình in ra cột...) không lộ
// luôn mã đang hiệu lực. OTP ngắn hạn (10 phút) + có rate-limit nên sha256 thường (không cần
// salt/bcrypt chậm như mật khẩu) là đủ, ưu tiên tốc độ vì verify được gọi liên tục khi người
// dùng gõ từng số.
export function hashOtpCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}
