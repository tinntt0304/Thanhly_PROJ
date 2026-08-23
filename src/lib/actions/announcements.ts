"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/admin-guard";

const announcementSchema = z.object({
  title: z.string().trim().min(1, "Thiếu tiêu đề"),
  content: z.string().trim().min(1, "Thiếu nội dung"),
});

export type AnnouncementFormState = { error?: string };

function revalidateAnnouncements() {
  revalidatePath("/thong-bao");
  revalidatePath("/admin/danh-muc");
}

export async function createAnnouncement(
  _prevState: AnnouncementFormState | undefined,
  formData: FormData
): Promise<AnnouncementFormState> {
  await requireSuperAdmin();

  const parsed = announcementSchema.safeParse({
    title: formData.get("title"),
    content: formData.get("content"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }

  await prisma.announcement.create({ data: parsed.data });
  revalidateAnnouncements();
  return {};
}

export async function updateAnnouncement(
  announcementId: string,
  _prevState: AnnouncementFormState | undefined,
  formData: FormData
): Promise<AnnouncementFormState> {
  await requireSuperAdmin();

  const parsed = announcementSchema.safeParse({
    title: formData.get("title"),
    content: formData.get("content"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }

  await prisma.announcement.update({ where: { id: announcementId }, data: parsed.data });
  revalidateAnnouncements();
  return {};
}

export async function togglePublishAnnouncement(announcementId: string, published: boolean) {
  await requireSuperAdmin();
  await prisma.announcement.update({ where: { id: announcementId }, data: { published } });
  revalidateAnnouncements();
}

export async function deleteAnnouncement(announcementId: string) {
  await requireSuperAdmin();
  await prisma.announcement.delete({ where: { id: announcementId } });
  revalidateAnnouncements();
}
