"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { getAuctionState, isBiddingOpen } from "@/lib/auction";
import { asAttributes } from "@/lib/attributes";
import type { Prisma } from "@/generated/prisma/client";

// Kích thước/cân nặng mặc định — giống hệt buyNowAction (actions/buy-now.ts), người bán chỉnh
// lại đúng số đo thật trước khi tạo vận đơn GHN nếu cần.
const DEFAULT_WEIGHT_GRAM = 500;
const DEFAULT_LENGTH_CM = 20;
const DEFAULT_WIDTH_CM = 20;
const DEFAULT_HEIGHT_CM = 10;

const selectedAttributeSchema = z.object({
  name: z.string().trim().min(1),
  value: z.string().trim().min(1),
});

export type AddToCartResult = { ok: true } | { ok: false; error: string };

// Chỉ nhận sản phẩm có buyNowPrice (Mua ngay) — sản phẩm chỉ đấu giá không "thêm vào giỏ"
// được vì giá không cố định, xem CartItem trong schema.prisma.
export async function addToCart(productId: string, selectedAttributesJson?: string): Promise<AddToCartResult> {
  const session = await requireAdmin();

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return { ok: false, error: "Không tìm thấy sản phẩm." };
  if (!product.buyNowPrice) return { ok: false, error: "Sản phẩm này không hỗ trợ mua ngay." };

  let selectedAttributes: { name: string; value: string }[] = [];
  if (selectedAttributesJson) {
    try {
      const rawParsed = JSON.parse(selectedAttributesJson);
      const arrayParsed = z.array(selectedAttributeSchema).safeParse(rawParsed);
      if (arrayParsed.success) selectedAttributes = arrayParsed.data;
    } catch {
      return { ok: false, error: "Dữ liệu thuộc tính không hợp lệ." };
    }
  }

  const productAttributes = asAttributes(product.attributes);
  for (const attr of productAttributes) {
    const picked = selectedAttributes.find((s) => s.name === attr.name);
    if (!picked || !attr.values.includes(picked.value)) {
      return { ok: false, error: `Vui lòng chọn "${attr.name}".` };
    }
  }

  await prisma.cartItem.upsert({
    where: { buyerId_productId: { buyerId: session.user.id, productId } },
    update: { selectedAttributes },
    create: { buyerId: session.user.id, productId, selectedAttributes },
  });

  revalidatePath("/gio-hang");
  return { ok: true };
}

export async function removeFromCart(productId: string): Promise<void> {
  const session = await requireAdmin();
  await prisma.cartItem.deleteMany({ where: { buyerId: session.user.id, productId } });
  revalidatePath("/gio-hang");
}

export type UpdateCartItemQuantityResult = { ok: true; quantity: number } | { ok: false; error: string };

// Buyer chỉnh số lượng trực tiếp ở trang giỏ hàng — luôn kẹp lại trong [1, Product.quantity]
// (số lượng thật còn lại) ngay khi lưu, không tin số buyer gửi lên.
export async function updateCartItemQuantity(
  productId: string,
  quantity: number
): Promise<UpdateCartItemQuantityResult> {
  const session = await requireAdmin();

  const product = await prisma.product.findUnique({ where: { id: productId }, select: { quantity: true } });
  if (!product) return { ok: false, error: "Không tìm thấy sản phẩm." };
  if (product.quantity <= 0) return { ok: false, error: "Sản phẩm đã hết hàng." };

  const clamped = Math.min(Math.max(Math.trunc(quantity) || 1, 1), product.quantity);

  const item = await prisma.cartItem.updateMany({
    where: { buyerId: session.user.id, productId },
    data: { quantity: clamped },
  });
  if (item.count === 0) return { ok: false, error: "Sản phẩm không có trong giỏ." };

  revalidatePath("/gio-hang");
  return { ok: true, quantity: clamped };
}

export async function getCartItems() {
  const session = await requireAdmin();
  return prisma.cartItem.findMany({
    where: { buyerId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { product: true },
  });
}

const checkoutSchema = z.object({
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
});

export type CheckoutCartState =
  | { ok: true; orderIds: string[] }
  | { ok: false; error: string };

// Đặt hàng toàn bộ giỏ trong 1 transaction — tất cả hoặc không gì cả: nếu 1 sản phẩm bất kỳ
// không còn mua được (hết hàng/đã huỷ/hết phiên) thì rollback toàn bộ, báo lỗi rõ sản phẩm nào,
// không checkout một phần (tránh buyer hiểu lầm "đã đặt hết" trong khi thiếu vài món). Lặp lại
// đúng pattern optimistic-lock của buyNowAction (actions/buy-now.ts) cho từng sản phẩm trong giỏ.
//
// Gộp theo người bán: nhiều sản phẩm CÙNG 1 seller trong giỏ → 1 Order duy nhất (nhiều
// OrderItem) để dễ theo dõi/tạo 1 vận đơn GHN chung — giống cách Shopee tách đơn theo shop lúc
// checkout. Giỏ có sản phẩm của nhiều seller khác nhau thì vẫn ra nhiều Order, mỗi seller 1 đơn
// riêng (Order chỉ có đúng 1 sellerId, không gộp được xuyên seller).
export async function checkoutCart(
  _prevState: CheckoutCartState | undefined,
  formData: FormData
): Promise<CheckoutCartState> {
  const session = await requireAdmin();

  const parsed = checkoutSchema.safeParse({
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
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }
  const data = parsed.data;

  const cartItems = await prisma.cartItem.findMany({
    where: { buyerId: session.user.id },
    include: { product: true },
  });
  if (cartItems.length === 0) {
    return { ok: false, error: "Giỏ hàng đang trống." };
  }

  try {
    const orderIds = await prisma.$transaction(async (tx) => {
      const bySeller = new Map<
        string,
        { productId: string; unitPrice: number; quantity: number; selectedAttributes: unknown }[]
      >();

      for (const item of cartItems) {
        const { product } = item;
        // Số lượng buyer chọn trong giỏ, kẹp lại 1 lần nữa phòng trường hợp kho đã tụt xuống
        // thấp hơn từ lúc chỉnh số lượng ở trang giỏ hàng tới lúc bấm đặt hàng.
        const wantQuantity = Math.min(Math.max(item.quantity, 1), Math.max(product.quantity, 1));

        if (!product.buyNowPrice) {
          throw new Error(`"${product.title}" không còn hỗ trợ mua ngay, vui lòng xoá khỏi giỏ.`);
        }

        const bidsCount = await tx.bid.count({ where: { productId: product.id } });
        const state = getAuctionState(product, bidsCount > 0);
        if (!isBiddingOpen(state)) {
          throw new Error(`"${product.title}" không còn mở để mua, vui lòng xoá khỏi giỏ.`);
        }

        // Cùng pattern optimistic-lock với buyNowAction: chỉ trừ kho nếu còn ACTIVE + đủ số lượng.
        const updateResult = await tx.product.updateMany({
          where: { id: product.id, status: "ACTIVE", quantity: { gte: wantQuantity } },
          data: { quantity: { decrement: wantQuantity } },
        });
        if (updateResult.count === 0) {
          throw new Error(`"${product.title}" không còn đủ hàng, vui lòng chỉnh lại số lượng.`);
        }

        const remaining = await tx.product.findUniqueOrThrow({
          where: { id: product.id },
          select: { quantity: true },
        });
        if (remaining.quantity <= 0) {
          await tx.product.update({ where: { id: product.id }, data: { status: "SOLD" } });
        }

        let sellerId = product.sellerId;
        if (!sellerId) {
          const superadmin = await tx.user.findFirst({ where: { role: "SUPERADMIN" }, select: { id: true } });
          if (!superadmin) throw new Error("Không xác định được người bán cho 1 sản phẩm trong giỏ.");
          sellerId = superadmin.id;
        }

        const group = bySeller.get(sellerId) ?? [];
        group.push({
          productId: product.id,
          unitPrice: product.buyNowPrice,
          quantity: wantQuantity,
          selectedAttributes: item.selectedAttributes ?? [],
        });
        bySeller.set(sellerId, group);
      }

      const ids: string[] = [];
      for (const [sellerId, items] of bySeller) {
        const codAmount = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
        const totalQuantity = items.reduce((sum, i) => sum + i.quantity, 0);
        const order = await tx.order.create({
          data: {
            sellerId,
            buyerId: session.user.id,
            buyerName: data.buyerName,
            buyerPhone: data.buyerPhone,
            buyerAddress: data.buyerAddress,
            provinceId: data.provinceId,
            provinceName: data.provinceName,
            districtId: data.districtId,
            districtName: data.districtName,
            wardCode: data.wardCode,
            wardName: data.wardName,
            codAmount,
            weightGram: DEFAULT_WEIGHT_GRAM * totalQuantity,
            lengthCm: DEFAULT_LENGTH_CM,
            widthCm: DEFAULT_WIDTH_CM,
            heightCm: DEFAULT_HEIGHT_CM,
            note: data.note || null,
            items: {
              create: items.map((i) => ({
                productId: i.productId,
                quantity: i.quantity,
                unitPrice: i.unitPrice,
                selectedAttributes: i.selectedAttributes as Prisma.InputJsonValue,
                stockDecremented: true,
              })),
            },
          },
        });
        ids.push(order.id);
      }

      await tx.cartItem.deleteMany({ where: { buyerId: session.user.id } });
      return ids;
    });

    revalidatePath("/gio-hang");
    revalidatePath("/");
    revalidatePath("/admin/orders");
    revalidatePath("/tai-khoan/don-hang");
    return { ok: true, orderIds };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Có lỗi xảy ra, vui lòng thử lại." };
  }
}
