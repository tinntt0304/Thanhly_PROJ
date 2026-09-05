"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { unstable_update } from "@/lib/auth";

export type AccountInfoFormState = { error?: string; success?: boolean };

const accountInfoSchema = z.object({
  name: z.string().trim().min(1, "Thiếu tên"),
  phone: z.string().trim().optional(),
});

// Email không sửa được ở đây — gắn liền với đăng nhập + xác minh OTP (EmailOtp), đổi email
// cần luồng xác minh lại riêng, chưa làm ở P0 này. Role/creditBalance cũng không tự sửa được
// (thuộc quyền superadmin qua UserCreditsManager, không phải tự thao tác trên chính mình).
export async function updateAccountInfo(
  _prevState: AccountInfoFormState | undefined,
  formData: FormData
): Promise<AccountInfoFormState> {
  const session = await requireAdmin();

  const parsed = accountInfoSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name: parsed.data.name, phone: parsed.data.phone || null },
  });

  // DB đã đổi nhưng session/JWT hiện tại (header, AccountMenu, mọi nơi đọc session.user.name)
  // vẫn giữ tên cũ trong cookie tới khi đăng xuất — đồng bộ lại ngay để khỏi cần đăng nhập lại.
  await unstable_update({ user: { name: parsed.data.name, phone: parsed.data.phone || null } });

  revalidatePath("/admin/account");
  return { success: true };
}

export type ChangePasswordFormState = { error?: string; success?: boolean };

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

export async function changePassword(
  _prevState: ChangePasswordFormState | undefined,
  formData: FormData
): Promise<ChangePasswordFormState> {
  const session = await requireAdmin();

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || !(await bcrypt.compare(parsed.data.currentPassword, user.passwordHash))) {
    return { error: "Mật khẩu hiện tại không đúng." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.user.update({ where: { id: session.user.id }, data: { passwordHash } });

  return { success: true };
}
