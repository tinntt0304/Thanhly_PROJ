"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import type { ProductStatus } from "@/generated/prisma/client";

const productSchema = z
  .object({
    title: z.string().trim().min(1, "Thiếu tên sản phẩm"),
    description: z.string().trim().min(1, "Thiếu mô tả"),
    condition: z.string().trim().min(1, "Thiếu tình trạng sản phẩm"),
    images: z
      .string()
      .transform((val) =>
        val
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean)
      )
      .refine((arr) => arr.length >= 1, "Cần ít nhất 1 ảnh (mỗi link 1 dòng)"),
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

export async function createProduct(
  _prevState: ProductFormState | undefined,
  formData: FormData
): Promise<ProductFormState> {
  await requireAdmin();

  const parsed = productSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    condition: formData.get("condition"),
    images: formData.get("images"),
    startPrice: formData.get("startPrice"),
    minBidStep: formData.get("minBidStep"),
    buyNowPrice: formData.get("buyNowPrice"),
    endTime: formData.get("endTime"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }

  const data = parsed.data;
  const product = await prisma.product.create({
    data: {
      title: data.title,
      description: data.description,
      condition: data.condition,
      images: data.images,
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
    images: formData.get("images"),
    startPrice: formData.get("startPrice"),
    minBidStep: formData.get("minBidStep"),
    buyNowPrice: formData.get("buyNowPrice"),
    endTime: formData.get("endTime"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }

  const data = parsed.data;
  await prisma.product.update({
    where: { id: productId },
    data: {
      title: data.title,
      description: data.description,
      condition: data.condition,
      images: data.images,
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
