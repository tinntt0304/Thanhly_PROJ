"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { sendOtpEmail } from "@/lib/email";
import { generateOtpCode, hashOtpCode, MAX_OTP_ATTEMPTS, OTP_EXPIRY_MINUTES } from "@/lib/otp";

export type LoginFormState = { error?: string };

const TOO_MANY_ATTEMPTS_ERROR = "Bạn đã thử quá nhiều lần, vui lòng đợi vài phút rồi thử lại.";

// Dùng chung cho registerAction (OTP đầu tiên) và resendOtpAction (gửi lại) — upsert theo
// userId (@@unique) nên gửi lại luôn ghi đè mã cũ + đặt lại attempts về 0, không cộng dồn
// nhiều hàng OTP cho 1 user. Bọc try/catch ở ĐÂY (không phải nơi gọi) để cả 2 chỗ gọi đều
// trả lỗi rõ ràng thay vì để throw xuyên Server Action (quy ước safeGhnCall, xem ghn.ts).
async function issueAndSendOtp(userId: string, email: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const code = generateOtpCode();
    await prisma.emailOtp.upsert({
      where: { userId },
      update: { codeHash: hashOtpCode(code), expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60_000), attempts: 0 },
      create: { userId, codeHash: hashOtpCode(code), expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60_000) },
    });
    await sendOtpEmail(email, code);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gửi email xác minh thất bại." };
  }
}

export async function loginAction(
  _prevState: LoginFormState | undefined,
  formData: FormData
): Promise<LoginFormState> {
  // Chặn dò mật khẩu (brute-force): giới hạn theo IP (1 người dò nhiều email khác nhau)
  // VÀ theo email (nhiều IP cùng dò 1 tài khoản, vd. botnet) — email raw chưa validate ở
  // đây nhưng dùng làm khoá rate-limit thì không cần chuẩn hoá, chỉ cần ổn định.
  const ip = await getClientIp();
  const emailRaw = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const [ipOk, emailOk] = await Promise.all([
    checkRateLimit(`login-ip:${ip}`, 20, 600),
    emailRaw ? checkRateLimit(`login-email:${emailRaw}`, 8, 600) : Promise.resolve(true),
  ]);
  if (!ipOk || !emailOk) {
    return { error: TOO_MANY_ATTEMPTS_ERROR };
  }

  // Tự kiểm tra mật khẩu ở đây (thay vì để authorize() của NextAuth làm rồi bắt AuthError
  // chung chung) vì cần rẽ nhánh riêng cho tài khoản CHƯA xác minh email — NextAuth Credentials
  // provider không cho phân biệt lý do thất bại cụ thể qua AuthError một cách gọn gàng.
  const user = await prisma.user.findUnique({ where: { email: emailRaw } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "Email hoặc mật khẩu không đúng." };
  }

  if (!user.emailVerified) {
    // Rate-limit riêng theo email (KHÔNG theo IP) — tránh 1 người khác đăng nhập thử email
    // này liên tục để spam hộp thư của chủ tài khoản.
    if (await checkRateLimit(`otp-issue-email:${emailRaw}`, 3, 600)) {
      const result = await issueAndSendOtp(user.id, user.email);
      if (!result.ok) return { error: result.error };
    }
    redirect(`/admin/verify-otp?email=${encodeURIComponent(user.email)}`);
  }

  try {
    await signIn("credentials", { email: emailRaw, password, redirectTo: "/admin" });
  } catch (e) {
    if (e instanceof AuthError) {
      return { error: "Email hoặc mật khẩu không đúng." };
    }
    throw e;
  }
  return {};
}

export type OtpFormState = { error?: string; success?: boolean };

export async function verifyOtpAction(
  _prevState: OtpFormState | undefined,
  formData: FormData
): Promise<OtpFormState> {
  const ip = await getClientIp();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const code = String(formData.get("code") ?? "").trim();
  if (!email || !code) return { error: "Thiếu email hoặc mã xác minh." };

  // Rate-limit theo IP: chặn dò 1 triệu khả năng mã 6 số bằng cách gửi request thẳng tới
  // action này (bỏ qua đếm attempts trên từng hàng OTP nếu request KHÔNG khớp email/OTP nào).
  if (!(await checkRateLimit(`otp-verify-ip:${ip}`, 20, 600))) {
    return { error: TOO_MANY_ATTEMPTS_ERROR };
  }

  const user = await prisma.user.findUnique({ where: { email }, include: { emailOtp: true } });
  if (!user || user.emailVerified) {
    return { error: "Yêu cầu không hợp lệ." };
  }
  if (!user.emailOtp || user.emailOtp.expiresAt < new Date()) {
    return { error: "Mã đã hết hạn, bấm \"Gửi lại mã\" để nhận mã mới." };
  }
  if (user.emailOtp.attempts >= MAX_OTP_ATTEMPTS) {
    return { error: "Bạn đã nhập sai quá nhiều lần, bấm \"Gửi lại mã\" để nhận mã mới." };
  }
  if (hashOtpCode(code) !== user.emailOtp.codeHash) {
    await prisma.emailOtp.update({ where: { userId: user.id }, data: { attempts: { increment: 1 } } });
    return { error: "Mã xác minh không đúng." };
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } }),
    prisma.emailOtp.delete({ where: { userId: user.id } }),
  ]);

  redirect("/admin/login?verified=1");
}

export type ResendOtpState = { error?: string; success?: boolean };

export async function resendOtpAction(
  _prevState: ResendOtpState | undefined,
  formData: FormData
): Promise<ResendOtpState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "Thiếu email." };

  if (!(await checkRateLimit(`otp-issue-email:${email}`, 3, 600))) {
    return { error: TOO_MANY_ATTEMPTS_ERROR };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // Không tiết lộ email này có tồn tại hay không (tránh dò email đã đăng ký) — vẫn báo
  // thành công nếu không tìm thấy user hoặc đã xác minh rồi.
  if (!user || user.emailVerified) {
    return { success: true };
  }

  const result = await issueAndSendOtp(user.id, user.email);
  if (!result.ok) return { error: result.error };
  return { success: true };
}

export type RegisterFormState = { error?: string };

const registerSchema = z
  .object({
    name: z.string().trim().min(1, "Thiếu họ tên"),
    email: z.string().trim().email("Email không hợp lệ"),
    phone: z
      .string()
      .trim()
      .regex(/^0\d{9}$/, "Số điện thoại phải có đúng 10 chữ số (ví dụ: 0901234567)"),
    password: z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Mật khẩu nhập lại không khớp",
    path: ["confirmPassword"],
  });

export async function registerAction(
  _prevState: RegisterFormState | undefined,
  formData: FormData
): Promise<RegisterFormState> {
  // Đăng ký công khai, không CAPTCHA — nếu không giới hạn, 1 script có thể tự tạo hàng
  // loạt tài khoản (mỗi tài khoản lại có thể dùng để né các rate-limit gắn theo userId
  // ở nơi khác, vd. tìm nhóm Facebook). Giới hạn theo IP.
  const ip = await getClientIp();
  if (!(await checkRateLimit(`register-ip:${ip}`, 5, 600))) {
    return { error: TOO_MANY_ATTEMPTS_ERROR };
  }

  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }

  const { name, email, phone, password } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 10);

  let userId: string;
  try {
    const user = await prisma.user.create({
      data: { name, email, phone, passwordHash, role: "SELLER", emailVerified: false },
    });
    userId = user.id;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "Email này đã được đăng ký." };
    }
    throw e;
  }

  // Gửi OTP thất bại thì xoá luôn tài khoản vừa tạo (rollback) — không để lại tài khoản
  // "mồ côi" không thể xác minh, chặn luôn người đó thử đăng ký lại đúng email này lần nữa.
  const result = await issueAndSendOtp(userId, email);
  if (!result.ok) {
    await prisma.user.delete({ where: { id: userId } });
    return { error: result.error };
  }

  redirect(`/admin/verify-otp?email=${encodeURIComponent(email)}`);
}
