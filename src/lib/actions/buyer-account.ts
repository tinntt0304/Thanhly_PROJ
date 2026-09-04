"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireBuyer } from "@/lib/buyer-guard";

export type BuyerAccountInfoFormState = { error?: string; success?: boolean };

const accountInfoSchema = z.object({
  name: z.string().trim().min(1, "Thiếu tên"),
});

// SĐT không sửa được ở đây — là định danh đăng nhập (mirror lý do email không sửa được ở
// src/lib/actions/account.ts của seller).
export async function updateBuyerInfo(
  _prevState: BuyerAccountInfoFormState | undefined,
  formData: FormData
): Promise<BuyerAccountInfoFormState> {
  const session = await requireBuyer();

  const parsed = accountInfoSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }

  await prisma.buyer.update({
    where: { id: session.user.id },
    data: { name: parsed.data.name },
  });

  revalidatePath("/tai-khoan");
  return { success: true };
}

export type BuyerChangePasswordFormState = { error?: string; success?: boolean };

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Thiếu mật khẩu hiện tại"),
    newPassword: z.string().min(6, "Mật khẩu mới phải có ít nhất 6 ký tự"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Xác nhận mật khẩu mới không khớp",
    path: ["confirmPassword"],
  });

export async function changeBuyerPassword(
  _prevState: BuyerChangePasswordFormState | undefined,
  formData: FormData
): Promise<BuyerChangePasswordFormState> {
  const session = await requireBuyer();

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }

  const buyer = await prisma.buyer.findUnique({ where: { id: session.user.id } });
  if (!buyer || !(await bcrypt.compare(parsed.data.currentPassword, buyer.passwordHash))) {
    return { error: "Mật khẩu hiện tại không đúng." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.buyer.update({ where: { id: session.user.id }, data: { passwordHash } });

  return { success: true };
}
