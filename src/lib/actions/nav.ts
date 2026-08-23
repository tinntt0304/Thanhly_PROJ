"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/admin-guard";

const navItemSchema = z.object({
  label: z.string().trim().min(1, "Thiếu tên mục menu"),
  href: z.string().trim().min(1, "Thiếu đường dẫn"),
  order: z.coerce.number().int(),
});

export type NavItemFormState = { error?: string };

function revalidateNav() {
  revalidatePath("/");
  revalidatePath("/admin/danh-muc");
}

export async function createNavItem(
  _prevState: NavItemFormState | undefined,
  formData: FormData
): Promise<NavItemFormState> {
  await requireSuperAdmin();

  const parsed = navItemSchema.safeParse({
    label: formData.get("label"),
    href: formData.get("href"),
    order: formData.get("order") || 0,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }

  await prisma.navItem.create({ data: parsed.data });
  revalidateNav();
  return {};
}

export async function updateNavItem(
  navItemId: string,
  _prevState: NavItemFormState | undefined,
  formData: FormData
): Promise<NavItemFormState> {
  await requireSuperAdmin();

  const parsed = navItemSchema.safeParse({
    label: formData.get("label"),
    href: formData.get("href"),
    order: formData.get("order") || 0,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }

  await prisma.navItem.update({ where: { id: navItemId }, data: parsed.data });
  revalidateNav();
  return {};
}

export async function deleteNavItem(navItemId: string) {
  await requireSuperAdmin();
  await prisma.navItem.delete({ where: { id: navItemId } });
  revalidateNav();
}
