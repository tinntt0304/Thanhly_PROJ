"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAuctionState, isBiddingOpen } from "@/lib/auction";
import { asAttributes } from "@/lib/attributes";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getBuyerSession } from "@/lib/buyer-guard";

// Kích thước/cân nặng mặc định khi tạo đơn từ "Mua ngay" — khách mua không cần khai
// (giống OrderForm.tsx dùng cho tạo đơn thủ công ở admin), người bán chỉnh lại đúng số đo
// thật trước khi tạo vận đơn GHN nếu cần.
const DEFAULT_WEIGHT_GRAM = 500;
const DEFAULT_LENGTH_CM = 20;
const DEFAULT_WIDTH_CM = 20;
const DEFAULT_HEIGHT_CM = 10;

const selectedAttributeSchema = z.object({
  name: z.string().trim().min(1),
  value: z.string().trim().min(1),
});

const buyNowSchema = z.object({
  productId: z.string().min(1),
  buyerName: z.string().trim().min(1, "Thiếu tên người nhận"),
  buyerPhone: z
    .string()
    .trim()
    .regex(/^0\d{9}$/, "Số điện thoại phải có đúng 10 chữ số (ví dụ: 0901234567)"),
  buyerAddress: z.string().trim().min(1, "Thiếu địa chỉ (số nhà, tên đường...)"),
  provinceId: z.coerce.number().int().positive("Chưa chọn tỉnh/thành"),
  provinceName: z.string().trim().min(1),
  districtId: z.coerce.number().int().positive("Chưa chọn quận/huyện"),
  districtName: z.string().trim().min(1),
  wardCode: z.string().trim().min(1, "Chưa chọn phường/xã"),
  wardName: z.string().trim().min(1),
  note: z.string().trim().optional(),
  selectedAttributesJson: z.string().optional(),
});

export type BuyNowState = { error?: string; success?: boolean; orderId?: string };

// Đơn hàng công khai: khách bấm "Mua ngay" ở trang sản phẩm (chưa đăng nhập) tự điền
// thông tin nhận hàng rồi tạo thẳng 1 Order — hiện ngay trong "Quản lý đơn hàng" của
// người bán ở admin (/admin/orders), y hệt đơn tạo thủ công, không cần thao tác gì thêm
// từ phía admin. Vì gọi công khai (không qua requireAdmin) nên phải tự kiểm tra kỹ hơn
// createOrder ở actions/orders.ts: rate-limit theo IP, trừ kho bằng updateMany có điều
// kiện để 2 người bấm "Mua ngay" gần như đồng thời không cùng trừ được 1 đơn vị cuối cùng.
//
// Mua ngay và đấu giá là 2 lối mua ĐỘC LẬP cho cùng 1 sản phẩm nhiều số lượng (quantity):
// mua ngay chỉ trừ kho, không tự đóng phiên đấu giá — người khác vẫn tiếp tục trả giá/mua
// ngay thêm bình thường cho tới khi quantity về 0 mới coi là hết hàng (status: SOLD).
export async function buyNowAction(
  productId: string,
  _prevState: BuyNowState | undefined,
  formData: FormData
): Promise<BuyNowState> {
  const ip = await getClientIp();
  const [ipOk, productOk] = await Promise.all([
    checkRateLimit(`buy-now-ip:${ip}`, 5, 600),
    checkRateLimit(`buy-now-product:${productId}`, 20, 600),
  ]);
  if (!ipOk || !productOk) {
    return { error: "Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút." };
  }

  const parsed = buyNowSchema.safeParse({
    productId,
    buyerName: formData.get("buyerName"),
    buyerPhone: formData.get("buyerPhone"),
    buyerAddress: formData.get("buyerAddress"),
    provinceId: formData.get("provinceId"),
    provinceName: formData.get("provinceName"),
    districtId: formData.get("districtId"),
    districtName: formData.get("districtName"),
    wardCode: formData.get("wardCode"),
    wardName: formData.get("wardName"),
    note: formData.get("note"),
    selectedAttributesJson: formData.get("selectedAttributesJson"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }
  const data = parsed.data;

  const phoneOk = await checkRateLimit(`buy-now-phone:${data.buyerPhone}`, 5, 600);
  if (!phoneOk) {
    return { error: "Số điện thoại này vừa đặt mua quá nhiều lần, vui lòng thử lại sau." };
  }

  let selectedAttributes: { name: string; value: string }[] = [];
  if (data.selectedAttributesJson) {
    try {
      const rawParsed = JSON.parse(data.selectedAttributesJson);
      const arrayParsed = z.array(selectedAttributeSchema).safeParse(rawParsed);
      if (arrayParsed.success) selectedAttributes = arrayParsed.data;
    } catch {
      return { error: "Dữ liệu thuộc tính không hợp lệ." };
    }
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return { error: "Không tìm thấy sản phẩm." };
  if (!product.buyNowPrice) return { error: "Sản phẩm này không hỗ trợ mua ngay." };

  const bidsCount = await prisma.bid.count({ where: { productId } });
  const state = getAuctionState(product, bidsCount > 0);
  if (!isBiddingOpen(state)) {
    return { error: "Phiên đấu giá này không còn mở để mua ngay." };
  }

  // Mỗi thuộc tính sản phẩm (nếu có) bắt buộc chọn đúng 1 trong các giá trị khai báo —
  // không tin dữ liệu chọn sẵn từ client, đối chiếu lại với chính Product.attributes.
  const productAttributes = asAttributes(product.attributes);
  for (const attr of productAttributes) {
    const picked = selectedAttributes.find((s) => s.name === attr.name);
    if (!picked || !attr.values.includes(picked.value)) {
      return { error: `Vui lòng chọn "${attr.name}".` };
    }
  }

  // Gắn buyerId nếu đang đăng nhập tài khoản người mua — hoàn toàn tuỳ chọn, đơn khách vãng
  // lai (chưa đăng nhập) vẫn tạo được bình thường như trước (buyerId null).
  const buyerSession = await getBuyerSession();

  try {
    const order = await prisma.$transaction(async (tx) => {
      // Mua ngay chỉ trừ đi 1 đơn vị trong quantity — KHÔNG tự động đóng cả phiên đấu giá
      // nếu vẫn còn hàng. Người khác vẫn tiếp tục trả giá/mua ngay được thêm cho tới khi hết
      // hàng thật sự (quantity về 0) mới chuyển status sang SOLD. updateMany có điều kiện
      // status: "ACTIVE" + quantity: {gt: 0} — 2 người cùng bấm "Mua ngay" gần như đồng thời
      // khi chỉ còn đúng 1 đơn vị thì chỉ 1 người trừ kho thành công (Postgres khoá dòng lúc
      // UPDATE, người tới sau đọc lại quantity đã về 0 nên điều kiện gt:0 không còn đúng),
      // người còn lại nhận lỗi rõ ràng thay vì tạo thêm 1 đơn cho hàng đã hết.
      const updateResult = await tx.product.updateMany({
        where: { id: productId, status: "ACTIVE", quantity: { gt: 0 } },
        data: { quantity: { decrement: 1 } },
      });
      if (updateResult.count === 0) {
        throw new Error("Sản phẩm này vừa hết hàng hoặc phiên đấu giá đã kết thúc, vui lòng tải lại trang.");
      }

      const remaining = await tx.product.findUniqueOrThrow({
        where: { id: productId },
        select: { quantity: true },
      });
      if (remaining.quantity <= 0) {
        await tx.product.update({ where: { id: productId }, data: { status: "SOLD" } });
      }

      let sellerId = product.sellerId;
      if (!sellerId) {
        const superadmin = await tx.user.findFirst({ where: { role: "SUPERADMIN" }, select: { id: true } });
        if (!superadmin) throw new Error("Không xác định được người bán cho sản phẩm này.");
        sellerId = superadmin.id;
      }

      return tx.order.create({
        data: {
          sellerId,
          productId,
          buyerId: buyerSession?.user.id ?? null,
          buyerName: data.buyerName,
          buyerPhone: data.buyerPhone,
          buyerAddress: data.buyerAddress,
          provinceId: data.provinceId,
          provinceName: data.provinceName,
          districtId: data.districtId,
          districtName: data.districtName,
          wardCode: data.wardCode,
          wardName: data.wardName,
          codAmount: product.buyNowPrice!,
          weightGram: DEFAULT_WEIGHT_GRAM,
          lengthCm: DEFAULT_LENGTH_CM,
          widthCm: DEFAULT_WIDTH_CM,
          heightCm: DEFAULT_HEIGHT_CM,
          note: data.note || null,
          selectedAttributes,
          stockDecremented: true, // đã trừ 1 đơn vị quantity ở trên — huỷ đơn (cancelOrder) sẽ hoàn lại đúng đơn vị này
        },
      });
    });

    revalidatePath(`/products/${productId}`);
    revalidatePath("/");
    revalidatePath("/admin/orders");
    return { success: true, orderId: order.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Có lỗi xảy ra, vui lòng thử lại." };
  }
}
