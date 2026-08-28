"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/admin-guard";
import { uploadBannerImage, deleteBannerImage } from "@/lib/storage";
import { MAX_BANNER_IMAGES } from "@/lib/product-limits";

const HOME_BANNER_KEY = "home_banner";

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

export type BannerImagesFormState = { error?: string; images?: string[] };

// Banner trang chủ dạng slideshow — cho tải nhiều ảnh, mỗi ảnh 1 dòng trong mảng images
// của HomeBannerConfig (key cố định "home_banner", chỉ 1 dòng duy nhất). Trả về mảng ảnh
// mới nhất để client cập nhật ngay không cần đợi revalidatePath.
export async function addBannerImages(
  _prevState: BannerImagesFormState | undefined,
  formData: FormData
): Promise<BannerImagesFormState> {
  await requireSuperAdmin();

  const files = formData.getAll("banners").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: "Chưa chọn ảnh banner." };

  const existing = await prisma.homeBannerConfig.findUnique({ where: { key: HOME_BANNER_KEY } });
  if ((existing?.images.length ?? 0) + files.length > MAX_BANNER_IMAGES) {
    return { error: `Tối đa ${MAX_BANNER_IMAGES} ảnh banner.` };
  }

  let uploadedUrls: string[];
  try {
    uploadedUrls = await Promise.all(files.map(uploadBannerImage));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Upload ảnh banner thất bại." };
  }

  const images = [...(existing?.images ?? []), ...uploadedUrls];
  await prisma.homeBannerConfig.upsert({
    where: { key: HOME_BANNER_KEY },
    update: { images },
    create: { key: HOME_BANNER_KEY, images },
  });

  revalidatePath("/");
  revalidatePath("/admin/danh-muc");
  return { images };
}

export async function removeBannerImage(url: string): Promise<BannerImagesFormState> {
  await requireSuperAdmin();

  const existing = await prisma.homeBannerConfig.findUnique({ where: { key: HOME_BANNER_KEY } });
  const images = (existing?.images ?? []).filter((u) => u !== url);

  await prisma.homeBannerConfig.upsert({
    where: { key: HOME_BANNER_KEY },
    update: { images },
    create: { key: HOME_BANNER_KEY, images },
  });
  // Best-effort: dọn file vật lý khỏi bucket, nhưng đơn xoá khỏi danh sách hiển thị (DB) ở
  // trên mới là điều quan trọng — không để lỗi xoá file chặn thao tác của người dùng.
  await deleteBannerImage(url).catch(() => {});

  revalidatePath("/");
  revalidatePath("/admin/danh-muc");
  return { images };
}

export type BannerIntervalFormState = { error?: string; intervalSeconds?: number };

const intervalSchema = z.coerce
  .number()
  .int("Phải là số nguyên")
  .min(1, "Tối thiểu 1 giây")
  .max(60, "Tối đa 60 giây");

export async function updateBannerInterval(
  _prevState: BannerIntervalFormState | undefined,
  formData: FormData
): Promise<BannerIntervalFormState> {
  await requireSuperAdmin();

  const parsed = intervalSchema.safeParse(formData.get("intervalSeconds"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Giá trị không hợp lệ." };
  }

  await prisma.homeBannerConfig.upsert({
    where: { key: HOME_BANNER_KEY },
    update: { intervalSeconds: parsed.data },
    create: { key: HOME_BANNER_KEY, intervalSeconds: parsed.data, images: [] },
  });

  revalidatePath("/");
  revalidatePath("/admin/danh-muc");
  return { intervalSeconds: parsed.data };
}
