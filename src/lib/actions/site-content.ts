"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/admin-guard";
import { uploadBannerImage } from "@/lib/storage";

const BANNER_KEY = "home_banner_image";

const contentSchema = z.object({
  content: z.string().trim().min(1, "Nội dung không được để trống"),
});

export type SiteContentFormState = { error?: string };

export async function updateSiteContent(
  key: string,
  _prevState: SiteContentFormState | undefined,
  formData: FormData
): Promise<SiteContentFormState> {
  await requireSuperAdmin();

  const parsed = contentSchema.safeParse({ content: formData.get("content") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }

  await prisma.siteContent.upsert({
    where: { key },
    update: { content: parsed.data.content },
    create: { key, content: parsed.data.content },
  });

  revalidatePath("/ve-chung-toi");
  revalidatePath("/admin/danh-muc");
  return {};
}

export type BannerFormState = { error?: string; url?: string };

// Ảnh banner trang chủ (nền HeroBanner) — lưu URL public Supabase Storage vào SiteContent
// (key "home_banner_image") thay vì bảng riêng, vì bản chất vẫn là 1 dòng singleton như
// about_us — không cần schema riêng chỉ để lưu 1 chuỗi URL.
export async function updateBanner(
  _prevState: BannerFormState | undefined,
  formData: FormData
): Promise<BannerFormState> {
  await requireSuperAdmin();

  const file = formData.get("banner");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Chưa chọn ảnh banner." };
  }

  let url: string;
  try {
    url = await uploadBannerImage(file);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Upload ảnh banner thất bại." };
  }

  await prisma.siteContent.upsert({
    where: { key: BANNER_KEY },
    update: { content: url },
    create: { key: BANNER_KEY, content: url },
  });

  revalidatePath("/");
  revalidatePath("/admin/danh-muc");
  return { url };
}

export async function removeBanner(): Promise<BannerFormState> {
  await requireSuperAdmin();
  await prisma.siteContent.deleteMany({ where: { key: BANNER_KEY } });
  revalidatePath("/");
  revalidatePath("/admin/danh-muc");
  return {};
}
