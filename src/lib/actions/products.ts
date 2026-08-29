"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { uploadProductImage } from "@/lib/storage";
import { MAX_IMAGES_PER_PRODUCT } from "@/lib/product-limits";
import type { Attribute } from "@/lib/attributes";
import { asProductTags } from "@/lib/tags";
import type { ProductStatus } from "@/generated/prisma/client";

const productSchema = z
  .object({
    title: z.string().trim().min(1, "Thiếu tên sản phẩm"),
    description: z.string().trim().min(1, "Thiếu mô tả"),
    condition: z.string().trim().min(1, "Thiếu tình trạng sản phẩm"),
    quantity: z.coerce.number().int().positive("Số lượng phải lớn hơn 0"),
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

const attributesJsonSchema = z.array(
  z.object({
    name: z.string(),
    values: z.array(z.string()),
  })
);

// Thuộc tính được gửi lên dạng 1 chuỗi JSON (mỗi thuộc tính có thể có nhiều giá trị,
// hiển thị thành nhiều tag riêng) thay vì các input tên/giá trị rời rạc — xem
// ProductForm.tsx.
function parseAttributes(formData: FormData): Attribute[] {
  const raw = formData.get("attributesJson");
  if (typeof raw !== "string" || raw.trim() === "") return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  const result = attributesJsonSchema.safeParse(parsed);
  if (!result.success) return [];

  return result.data
    .map((a) => ({
      name: a.name.trim(),
      values: a.values.map((v) => v.trim()).filter(Boolean),
    }))
    .filter((a) => a.name.length > 0 && a.values.length > 0);
}

// SELLER chỉ được sửa/đổi trạng thái sản phẩm của chính mình — SUPERADMIN thấy và sửa
// được tất cả. Ném lỗi nếu không có quyền (đọc được bằng try/catch ở caller).
async function assertOwnsProduct(userId: string, role: string, productId: string) {
  if (role === "SUPERADMIN") return;
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { sellerId: true },
  });
  if (!product || product.sellerId !== userId) {
    throw new Error("Bạn không có quyền chỉnh sửa sản phẩm này.");
  }
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
  const session = await requireAdmin();

  const parsed = productSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    condition: formData.get("condition"),
    quantity: formData.get("quantity"),
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
  const tags = asProductTags(formData.getAll("tags").map(String));

  const product = await prisma.product.create({
    data: {
      sellerId: session.user.id,
      title: data.title,
      description: data.description,
      condition: data.condition,
      quantity: data.quantity,
      images,
      attributes,
      tags,
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
  const session = await requireAdmin();

  try {
    await assertOwnsProduct(session.user.id, session.user.role, productId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Không có quyền." };
  }

  const parsed = productSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    condition: formData.get("condition"),
    quantity: formData.get("quantity"),
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
  const tags = asProductTags(formData.getAll("tags").map(String));

  await prisma.product.update({
    where: { id: productId },
    data: {
      title: data.title,
      description: data.description,
      condition: data.condition,
      quantity: data.quantity,
      images,
      attributes,
      tags,
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
  const session = await requireAdmin();
  await assertOwnsProduct(session.user.id, session.user.role, productId);

  await prisma.product.update({
    where: { id: productId },
    data: { status },
  });

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath(`/products/${productId}`);
  revalidatePath(`/admin/products/${productId}`);
}

export type BulkEndTimeResult = { ok: true; count: number } | { ok: false; error: string };

// Chọn nhiều sản phẩm ở /admin, đặt chung 1 thời gian kết thúc — dùng cho trường hợp gộp
// nhiều sản phẩm vào cùng 1 đợt đấu giá kết thúc đồng loạt. SELLER phải sở hữu TẤT CẢ sản
// phẩm đã chọn mới cho áp dụng (từ chối toàn bộ nếu có 1 sản phẩm không thuộc về mình, không
// âm thầm bỏ qua — tránh hiểu lầm "đã áp dụng hết" trong khi thật ra thiếu vài sản phẩm).
export async function bulkSetEndTime(productIds: string[], endTime: string): Promise<BulkEndTimeResult> {
  const session = await requireAdmin();

  if (productIds.length === 0) return { ok: false, error: "Chưa chọn sản phẩm nào." };

  const parsedTime = new Date(endTime);
  if (Number.isNaN(parsedTime.getTime())) return { ok: false, error: "Thời gian không hợp lệ." };
  if (parsedTime.getTime() <= Date.now()) {
    return { ok: false, error: "Thời gian kết thúc phải ở tương lai." };
  }

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, sellerId: true },
  });
  if (products.length !== productIds.length) {
    return { ok: false, error: "Có sản phẩm không tồn tại, thử tải lại trang." };
  }
  if (session.user.role !== "SUPERADMIN" && products.some((p) => p.sellerId !== session.user.id)) {
    return { ok: false, error: "Bạn không có quyền sửa 1 hoặc nhiều sản phẩm đã chọn." };
  }

  const result = await prisma.product.updateMany({
    where: { id: { in: productIds } },
    data: { endTime: parsedTime },
  });

  revalidatePath("/");
  revalidatePath("/admin");
  return { ok: true, count: result.count };
}
