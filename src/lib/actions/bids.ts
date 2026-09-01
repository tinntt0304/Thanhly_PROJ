"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAuctionState, isBiddingOpen, minNextBid } from "@/lib/auction";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

// Chặn 1 lượt trả giá duy nhất đẩy currentPrice lên gấp quá nhiều lần bước giá tối thiểu —
// không cần đăng nhập, không rate-limit trước đây nên 1 request có thể set currentPrice lên
// bất kỳ số nào (vd. 999,999,999,999đ), phá hẳn phiên đấu giá (không ai trả nổi mức tối thiểu
// tiếp theo nữa) mà không cần gọi lại lần 2. Trần gắn theo minBidStep của chính sản phẩm (thay
// vì 1 số tuyệt đối) nên co giãn tự nhiên theo giá trị món hàng, vẫn đủ rộng cho trả giá thật.
const MAX_BID_STEP_MULTIPLE = 1000;

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

  // Public, không đăng nhập — chặn spam trả giá theo IP (1 script gọi liên tục) VÀ theo sản
  // phẩm (nhiều IP/script cùng nhắm 1 sản phẩm), cùng tinh thần với buyNowAction.
  const ip = await getClientIp();
  const [ipOk, productOk] = await Promise.all([
    checkRateLimit(`bid-ip:${ip}`, 20, 60),
    checkRateLimit(`bid-product:${productId}`, 100, 60),
  ]);
  if (!ipOk || !productOk) {
    return { error: "Bạn thao tác quá nhanh, vui lòng thử lại sau ít giây." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product) throw new Error("Không tìm thấy sản phẩm.");

      const bidsCount = await tx.bid.count({ where: { productId } });
      const state = getAuctionState(product, bidsCount > 0);
      if (!isBiddingOpen(state)) {
        throw new Error("Phiên đấu giá này không còn mở để trả giá.");
      }

      // currentPrice luôn được cập nhật cùng lúc với việc tạo 1 Bid có amount tương ứng,
      // nên nếu đã có bid trùng đúng số tiền này thì chắc chắn là 2 người cùng đẩy 1 mức
      // giá — kiểm tra trước, báo lỗi rõ ràng thay vì lỗi "thấp hơn mức tối thiểu" chung
      // chung (vì mức tối thiểu đọc được ở đây đã dựa trên currentPrice mới nhất).
      const sameAmountBid = await tx.bid.findFirst({ where: { productId, amount } });
      if (sameAmountBid) {
        throw new Error("Đã có người đấu giá mức giá này. Vui lòng đấu giá lại.");
      }

      const minAllowed = minNextBid(product);
      if (amount < minAllowed) {
        throw new Error(`Mức giá phải từ ${minAllowed.toLocaleString("vi-VN")}đ trở lên.`);
      }

      const maxAllowed = product.currentPrice + product.minBidStep * MAX_BID_STEP_MULTIPLE;
      if (amount > maxAllowed) {
        throw new Error(`Mức giá tối đa cho 1 lượt trả giá là ${maxAllowed.toLocaleString("vi-VN")}đ.`);
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
