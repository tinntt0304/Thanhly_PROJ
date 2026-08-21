"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { uploadProductImage } from "@/lib/storage";
import { MAX_IMAGES_PER_PRODUCT } from "@/lib/product-limits";
import type { Attribute } from "@/lib/attributes";
import type { ProductStatus } from "@/generated/prisma/client";

const productSchema = z
  .object({
    title: z.string().trim().min(1, "Thiếu tên sản phẩm"),
    description: z.string().trim().min(1, "Thiếu mô tả"),
    condition: z.string().trim().min(1, "Thiếu tình trạng sản phẩm"),
    startPrice: z.coerce.number().int().positive("Giá khởi điểm phải lớn hơn 0"),
    minBidStep: z.coerce.number().int().positive("Bước giá phải lớn hơn 0"),
    buyNowPrice: z
      .string()
      .optional()
      .transform((v) => (v && v.trim() !== "" ? Number(v) : undefined)),
    endTime: z.string().min(1, "Thiếu thời gian kết thúc"),
  })
  .refine((data) => new Date(data.endTime).getTime() > Date.now(), {
    message: "Thời gian kết thúc phải ở tương lai",
    path: ["endTime"],
  })
  .refine((data) => !data.buyNowPrice || data.buyNowPrice > data.startPrice, {
    message: "Giá mua ngay phải cao hơn giá khởi điểm",
    path: ["buyNowPrice"],
  });

export type ProductFormState = { error?: string };

function parseAttributes(formData: FormData): Attribute[] {
  const names = formData.getAll("attrName").map(String);
  const values = formData.getAll("attrValue").map(String);
  return names
    .map((name, i) => ({ name: name.trim(), value: (values[i] ?? "").trim() }))
    .filter((a) => a.name.length > 0 && a.value.length > 0);
}

// Trả về danh sách URL ảnh cuối cùng = ảnh cũ được giữ lại + ảnh mới upload lên
// Supabase Storage. Ném lỗi (đọc được bằng try/catch ở caller) nếu upload thất bại
// hoặc không đủ ảnh.
async function resolveImages(formData: FormData): Promise<string[]> {
  const keptImages = formData.getAll("keptImages").map(String).filter(Boolean);
  const files = formData.getAll("imageFiles").filter(
    (f): f is File => f instanceof File && f.size > 0
  );

  if (keptImages.length + files.length === 0) {
    throw new Error("Cần ít nhất 1 ảnh sản phẩm.");
  }
  if (keptImages.length + files.length > MAX_IMAGES_PER_PRODUCT) {
    throw new Error(`Chỉ được tối đa ${MAX_IMAGES_PER_PRODUCT} ảnh mỗi sản phẩm.`);
  }

  const uploadedUrls = await Promise.all(files.map(uploadProductImage));
  return [...keptImages, ...uploadedUrls];
}

export async function createProduct(
  _prevState: ProductFormState | undefined,
  formData: FormData
): Promise<ProductFormState> {
  await requireAdmin();

  const parsed = productSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    condition: formData.get("condition"),
    startPrice: formData.get("startPrice"),
    minBidStep: formData.get("minBidStep"),
    buyNowPrice: formData.get("buyNowPrice"),
    endTime: formData.get("endTime"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }

  let images: string[];
  try {
    images = await resolveImages(formData);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Upload ảnh thất bại." };
  }

  const data = parsed.data;
  const attributes = parseAttributes(formData);

  const product = await prisma.product.create({
    data: {
      title: data.title,
      description: data.description,
      condition: data.condition,
      images,
      attributes,
      startPrice: data.startPrice,
      minBidStep: data.minBidStep,
      currentPrice: data.startPrice,
      buyNowPrice: data.buyNowPrice ?? null,
      endTime: new Date(data.endTime),
    },
  });

  revalidatePath("/");
  revalidatePath("/admin");
  redirect(`/admin/products/${product.id}`);
}

export async function updateProduct(
  productId: string,
  _prevState: ProductFormState | undefined,
  formData: FormData
): Promise<ProductFormState> {
  await requireAdmin();

  const parsed = productSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    condition: formData.get("condition"),
    startPrice: formData.get("startPrice"),
    minBidStep: formData.get("minBidStep"),
    buyNowPrice: formData.get("buyNowPrice"),
    endTime: formData.get("endTime"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }

  let images: string[];
  try {
    images = await resolveImages(formData);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Upload ảnh thất bại." };
  }

  const data = parsed.data;
  const attributes = parseAttributes(formData);

  await prisma.product.update({
    where: { id: productId },
    data: {
      title: data.title,
      description: data.description,
      condition: data.condition,
      images,
      attributes,
      startPrice: data.startPrice,
      minBidStep: data.minBidStep,
      buyNowPrice: data.buyNowPrice ?? null,
      endTime: new Date(data.endTime),
    },
  });

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath(`/products/${productId}`);
  revalidatePath(`/admin/products/${productId}`);
  return {};
}

export async function setProductStatus(productId: string, status: ProductStatus) {
  await requireAdmin();

  await prisma.product.update({
    where: { id: productId },
    data: { status },
  });

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath(`/products/${productId}`);
  revalidatePath(`/admin/products/${productId}`);
}
