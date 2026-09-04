"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireBuyer } from "@/lib/buyer-guard";
import { getAuctionState, isBiddingOpen } from "@/lib/auction";
import { asAttributes } from "@/lib/attributes";

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
  const session = await requireBuyer();

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
  const session = await requireBuyer();
  await prisma.cartItem.deleteMany({ where: { buyerId: session.user.id, productId } });
  revalidatePath("/gio-hang");
}

export async function getCartItems() {
  const session = await requireBuyer();
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
export async function checkoutCart(
  _prevState: CheckoutCartState | undefined,
  formData: FormData
): Promise<CheckoutCartState> {
  const session = await requireBuyer();

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
      const ids: string[] = [];

      for (const item of cartItems) {
        const { product } = item;

        if (!product.buyNowPrice) {
          throw new Error(`"${product.title}" không còn hỗ trợ mua ngay, vui lòng xoá khỏi giỏ.`);
        }

        const bidsCount = await tx.bid.count({ where: { productId: product.id } });
        const state = getAuctionState(product, bidsCount > 0);
        if (!isBiddingOpen(state)) {
          throw new Error(`"${product.title}" không còn mở để mua, vui lòng xoá khỏi giỏ.`);
        }

        // Cùng pattern optimistic-lock với buyNowAction: chỉ trừ kho nếu còn ACTIVE + quantity > 0.
        const updateResult = await tx.product.updateMany({
          where: { id: product.id, status: "ACTIVE", quantity: { gt: 0 } },
          data: { quantity: { decrement: 1 } },
        });
        if (updateResult.count === 0) {
          throw new Error(`"${product.title}" vừa hết hàng, vui lòng xoá khỏi giỏ và thử lại.`);
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

        const order = await tx.order.create({
          data: {
            sellerId,
            productId: product.id,
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
            codAmount: product.buyNowPrice,
            weightGram: DEFAULT_WEIGHT_GRAM,
            lengthCm: DEFAULT_LENGTH_CM,
            widthCm: DEFAULT_WIDTH_CM,
            heightCm: DEFAULT_HEIGHT_CM,
            note: data.note || null,
            selectedAttributes: item.selectedAttributes ?? [],
            stockDecremented: true,
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
