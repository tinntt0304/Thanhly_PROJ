"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAuctionState, isBiddingOpen, minNextBid } from "@/lib/auction";

const bidSchema = z.object({
  productId: z.string().min(1),
  phone: z
    .string()
    .trim()
    .regex(/^0\d{9}$/, "Số điện thoại phải có đúng 10 chữ số (ví dụ: 0901234567)"),
  amount: z.coerce.number().int().positive("Mức giá không hợp lệ"),
});

export type BidFormState = { error?: string; success?: boolean };

export async function placeBid(
  _prevState: BidFormState | undefined,
  formData: FormData
): Promise<BidFormState> {
  const parsed = bidSchema.safeParse({
    productId: formData.get("productId"),
    phone: formData.get("phone"),
    amount: formData.get("amount"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }

  const { productId, phone, amount } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product) throw new Error("Không tìm thấy sản phẩm.");

      const bidsCount = await tx.bid.count({ where: { productId } });
      const state = getAuctionState(product, bidsCount > 0);
      if (!isBiddingOpen(state)) {
        throw new Error("Phiên đấu giá này không còn mở để trả giá.");
      }

      const minAllowed = minNextBid(product);
      if (amount < minAllowed) {
        throw new Error(`Mức giá phải từ ${minAllowed.toLocaleString("vi-VN")}đ trở lên.`);
      }

      // Optimistic concurrency: chỉ cập nhật nếu currentPrice chưa bị người khác trả giá
      // trước trong lúc mình đang xử lý — tránh mất dữ liệu khi 2 người bấm gần như cùng lúc.
      const updateResult = await tx.product.updateMany({
        where: { id: productId, currentPrice: product.currentPrice },
        data: { currentPrice: amount },
      });
      if (updateResult.count === 0) {
        throw new Error("Vừa có người trả giá khác nhanh hơn, vui lòng tải lại trang và thử lại.");
      }

      await tx.bid.create({ data: { productId, phone, amount } });
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Có lỗi xảy ra, vui lòng thử lại." };
  }

  revalidatePath(`/products/${productId}`);
  revalidatePath("/");
  return { success: true };
}
