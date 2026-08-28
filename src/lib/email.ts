// Gửi email thật qua Resend (https://resend.com/docs/api-reference/emails/send-email) —
// dùng fetch thẳng tới REST API thay vì SDK, theo đúng quy ước dự án (xem ghn.ts) thay vì
// thêm dependency cho 1 lệnh gọi POST duy nhất.
//
// LƯU Ý VẬN HÀNH: chưa xác minh domain riêng trên Resend thì tài khoản chỉ ở "chế độ test" —
// CHỈ gửi được tới đúng email dùng đăng ký tài khoản Resend hoặc địa chỉ test của Resend
// (vd. delivered@resend.dev), gửi tới email thật của người dùng đăng ký sẽ bị Resend từ chối
// (422). Xác minh domain tại resend.com/domains rồi đổi RESEND_FROM_EMAIL sang địa chỉ thuộc
// domain đó (vd. no-reply@tenmien.com) để gửi được cho bất kỳ ai — xem docs/SETUP.md.
const RESEND_API_URL = "https://api.resend.com/emails";

function assertConfigured() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("Chưa cấu hình RESEND_API_KEY — liên hệ quản trị viên để hoàn tất thiết lập.");
  }
}

export async function sendOtpEmail(to: string, code: string): Promise<void> {
  assertConfigured();
  const from = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `hifen <${from}>`,
      to,
      subject: `${code} là mã xác minh tài khoản hifen của bạn`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #111;">Xác minh tài khoản hifen</h2>
          <p>Mã xác minh của bạn là:</p>
          <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #c2410c;">${code}</p>
          <p style="color: #555; font-size: 14px;">Mã có hiệu lực trong 10 phút. Nếu bạn không yêu cầu mã này, hãy bỏ qua email.</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.message || "Gửi email xác minh thất bại.");
  }
}
