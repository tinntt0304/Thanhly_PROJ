"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { prisma } from "@/lib/prisma";
import { buyerSignIn } from "@/lib/buyer-auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const TOO_MANY_ATTEMPTS_ERROR = "Bạn đã thử quá nhiều lần, vui lòng đợi vài phút rồi thử lại.";

export type BuyerLoginFormState = { error?: string };

export async function buyerLoginAction(
  _prevState: BuyerLoginFormState | undefined,
  formData: FormData
): Promise<BuyerLoginFormState> {
  const ip = await getClientIp();
  const phone = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const [ipOk, phoneOk] = await Promise.all([
    checkRateLimit(`buyer-login-ip:${ip}`, 20, 600),
    phone ? checkRateLimit(`buyer-login-phone:${phone}`, 8, 600) : Promise.resolve(true),
  ]);
  if (!ipOk || !phoneOk) {
    return { error: TOO_MANY_ATTEMPTS_ERROR };
  }

  const redirectTo = safeRedirectTarget(formData.get("next"));

  try {
    await buyerSignIn("credentials", { phone, password, redirectTo });
  } catch (e) {
    if (e instanceof AuthError) {
      return { error: "Số điện thoại hoặc mật khẩu không đúng." };
    }
    throw e;
  }
  return {};
}

// Chỉ nhận đường dẫn nội bộ bắt đầu bằng "/" và KHÔNG bắt đầu bằng "//" (tránh open redirect
// kiểu protocol-relative URL, vd. ?next=//evil.com bị trình duyệt hiểu thành //evil.com).
function safeRedirectTarget(value: FormDataEntryValue | null): string {
  if (typeof value === "string" && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return "/";
}

const registerSchema = z
  .object({
    name: z.string().trim().min(1, "Thiếu tên"),
    phone: z
      .string()
      .trim()
      .regex(/^0\d{9}$/, "Số điện thoại phải có đúng 10 chữ số (ví dụ: 0901234567)"),
    password: z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Xác nhận mật khẩu không khớp",
    path: ["confirmPassword"],
  });

export type BuyerRegisterFormState = { error?: string };

export async function registerBuyerAction(
  _prevState: BuyerRegisterFormState | undefined,
  formData: FormData
): Promise<BuyerRegisterFormState> {
  const ip = await getClientIp();
  const ipOk = await checkRateLimit(`buyer-register-ip:${ip}`, 10, 600);
  if (!ipOk) return { error: TOO_MANY_ATTEMPTS_ERROR };

  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }
  const data = parsed.data;

  const existing = await prisma.buyer.findUnique({ where: { phone: data.phone } });
  if (existing) {
    return { error: "Số điện thoại này đã có tài khoản, vui lòng đăng nhập." };
  }

  const passwordHash = await bcrypt.hash(data.password, 10);
  await prisma.buyer.create({
    data: { name: data.name, phone: data.phone, passwordHash },
  });

  const redirectTo = safeRedirectTarget(formData.get("next"));

  try {
    await buyerSignIn("credentials", { phone: data.phone, password: data.password, redirectTo });
  } catch (e) {
    if (e instanceof AuthError) {
      return { error: "Tạo tài khoản thành công nhưng tự đăng nhập thất bại, vui lòng đăng nhập lại." };
    }
    throw e;
  }
  return {};
}
