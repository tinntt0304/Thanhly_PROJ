"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { Prisma } from "@/generated/prisma/client";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export type LoginFormState = { error?: string };

const TOO_MANY_ATTEMPTS_ERROR = "Bạn đã thử quá nhiều lần, vui lòng đợi vài phút rồi thử lại.";

export async function loginAction(
  _prevState: LoginFormState | undefined,
  formData: FormData
): Promise<LoginFormState> {
  // Chặn dò mật khẩu (brute-force): giới hạn theo IP (1 người dò nhiều email khác nhau)
  // VÀ theo email (nhiều IP cùng dò 1 tài khoản, vd. botnet) — email raw chưa validate ở
  // đây nhưng dùng làm khoá rate-limit thì không cần chuẩn hoá, chỉ cần ổn định.
  const ip = await getClientIp();
  const emailRaw = String(formData.get("email") ?? "").trim().toLowerCase();
  const [ipOk, emailOk] = await Promise.all([
    checkRateLimit(`login-ip:${ip}`, 20, 600),
    emailRaw ? checkRateLimit(`login-email:${emailRaw}`, 8, 600) : Promise.resolve(true),
  ]);
  if (!ipOk || !emailOk) {
    return { error: TOO_MANY_ATTEMPTS_ERROR };
  }

  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/admin",
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return { error: "Email hoặc mật khẩu không đúng." };
    }
    throw e;
  }
  return {};
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

  try {
    await prisma.user.create({
      data: { name, email, phone, passwordHash, role: "SELLER" },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "Email này đã được đăng ký." };
    }
    throw e;
  }

  try {
    await signIn("credentials", { email, password, redirectTo: "/admin" });
  } catch (e) {
    if (e instanceof AuthError) {
      return { error: "Đăng ký thành công nhưng đăng nhập tự động thất bại — hãy đăng nhập thủ công." };
    }
    throw e;
  }
  return {};
}
