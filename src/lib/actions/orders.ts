"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import {
  getProvinces as ghnGetProvinces,
  getDistricts as ghnGetDistricts,
  getWards as ghnGetWards,
  createGhnOrder,
  getGhnOrderDetail,
  cancelGhnOrder,
  REQUIRED_NOTE_OPTIONS,
  type RequiredNote,
} from "@/lib/ghn";
import { ORDERS_PAGE_SIZE } from "@/lib/orders";

// ===== Tra cứu tỉnh/quận/phường GHN — dùng cho AddressPicker ở form tạo đơn =====
// Chỉ cần đăng nhập (không cần quyền đặc biệt), bọc lại thành server action vì
// GHN_TOKEN chỉ có ở server, client không được gọi thẳng API GHN.

export async function getGhnProvinces() {
  await requireAdmin();
  return ghnGetProvinces();
}

export async function getGhnDistricts(provinceId: number) {
  await requireAdmin();
  return ghnGetDistricts(provinceId);
}

export async function getGhnWards(districtId: number) {
  await requireAdmin();
  return ghnGetWards(districtId);
}

// SELLER chỉ thao tác được đơn của chính mình — SUPERADMIN thấy và sửa được tất cả,
// giống hệt quy ước ownership của Product (assertOwnsProduct ở products.ts).
async function assertOwnsOrder(userId: string, role: string, orderId: string) {
  if (role === "SUPERADMIN") return;
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { sellerId: true } });
  if (!order || order.sellerId !== userId) {
    throw new Error("Bạn không có quyền thao tác với đơn hàng này.");
  }
}

const orderSchema = z.object({
  buyerName: z.string().trim().min(1, "Thiếu tên người nhận"),
  buyerPhone: z.string().trim().min(1, "Thiếu số điện thoại người nhận"),
  buyerAddress: z.string().trim().min(1, "Thiếu địa chỉ (số nhà, tên đường...)"),
  provinceId: z.coerce.number().int().positive("Chưa chọn tỉnh/thành"),
  provinceName: z.string().trim().min(1),
  districtId: z.coerce.number().int().positive("Chưa chọn quận/huyện"),
  districtName: z.string().trim().min(1),
  wardCode: z.string().trim().min(1, "Chưa chọn phường/xã"),
  wardName: z.string().trim().min(1),
  codAmount: z.coerce.number().int().min(0),
  weightGram: z.coerce.number().int().positive("Cân nặng phải lớn hơn 0"),
  lengthCm: z.coerce.number().int().positive(),
  widthCm: z.coerce.number().int().positive(),
  heightCm: z.coerce.number().int().positive(),
  note: z.string().trim().optional(),
  shopPaysShipping: z.coerce.boolean(),
});

export type OrderFormState = { error?: string };

export async function createOrder(
  productId: string,
  _prevState: OrderFormState | undefined,
  formData: FormData
): Promise<OrderFormState> {
  const session = await requireAdmin();

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return { error: "Không tìm thấy sản phẩm." };
  if (session.user.role !== "SUPERADMIN" && product.sellerId !== session.user.id) {
    return { error: "Bạn không có quyền tạo đơn hàng cho sản phẩm này." };
  }

  const parsed = orderSchema.safeParse({
    buyerName: formData.get("buyerName"),
    buyerPhone: formData.get("buyerPhone"),
    buyerAddress: formData.get("buyerAddress"),
    provinceId: formData.get("provinceId"),
    provinceName: formData.get("provinceName"),
    districtId: formData.get("districtId"),
    districtName: formData.get("districtName"),
    wardCode: formData.get("wardCode"),
    wardName: formData.get("wardName"),
    codAmount: formData.get("codAmount"),
    weightGram: formData.get("weightGram"),
    lengthCm: formData.get("lengthCm"),
    widthCm: formData.get("widthCm"),
    heightCm: formData.get("heightCm"),
    note: formData.get("note"),
    shopPaysShipping: formData.get("shopPaysShipping") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }

  const data = parsed.data;
  const order = await prisma.order.create({
    data: {
      sellerId: product.sellerId ?? session.user.id,
      productId: product.id,
      buyerName: data.buyerName,
      buyerPhone: data.buyerPhone,
      buyerAddress: data.buyerAddress,
      provinceId: data.provinceId,
      provinceName: data.provinceName,
      districtId: data.districtId,
      districtName: data.districtName,
      wardCode: data.wardCode,
      wardName: data.wardName,
      codAmount: data.codAmount,
      weightGram: data.weightGram,
      lengthCm: data.lengthCm,
      widthCm: data.widthCm,
      heightCm: data.heightCm,
      note: data.note || null,
      shopPaysShipping: data.shopPaysShipping,
    },
  });

  revalidatePath("/admin/orders");
  redirect(`/admin/orders/${order.id}`);
}

export type OrderListItem = Awaited<ReturnType<typeof listOrders>>["items"][number];

export async function listOrders(page: number = 1) {
  const session = await requireAdmin();
  const isSuperAdmin = session.user.role === "SUPERADMIN";
  const safePage = Math.max(1, Math.trunc(page) || 1);

  const where = isSuperAdmin ? undefined : { sellerId: session.user.id };
  const [items, totalCount] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * ORDERS_PAGE_SIZE,
      take: ORDERS_PAGE_SIZE,
      include: { product: { select: { title: true } }, seller: { select: { name: true } } },
    }),
    prisma.order.count({ where }),
  ]);

  return { items, totalCount, page: safePage, pageSize: ORDERS_PAGE_SIZE };
}

export async function getOrder(orderId: string) {
  const session = await requireAdmin();
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { product: { select: { id: true, title: true, images: true } } },
  });
  if (!order) return null;
  if (session.user.role !== "SUPERADMIN" && order.sellerId !== session.user.id) return null;
  return order;
}

export type GhnActionResult = { ok: true } | { ok: false; error: string };

export async function createGhnShipment(orderId: string, requiredNote: RequiredNote): Promise<GhnActionResult> {
  const session = await requireAdmin();
  try {
    await assertOwnsOrder(session.user.id, session.user.role, orderId);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Không có quyền." };
  }
  if (!REQUIRED_NOTE_OPTIONS.some((o) => o.value === requiredNote)) {
    return { ok: false, error: "Tuỳ chọn xem hàng không hợp lệ." };
  }

  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { product: true } });
  if (!order) return { ok: false, error: "Không tìm thấy đơn hàng." };
  if (order.ghnOrderCode) return { ok: false, error: "Đơn này đã có vận đơn GHN rồi." };
  if (order.status === "CANCELLED") return { ok: false, error: "Đơn đã huỷ, không tạo vận đơn được." };

  try {
    const result = await createGhnOrder({
      toName: order.buyerName,
      toPhone: order.buyerPhone,
      toAddress: order.buyerAddress,
      toWardCode: order.wardCode,
      toDistrictId: order.districtId,
      weightGram: order.weightGram,
      lengthCm: order.lengthCm,
      widthCm: order.widthCm,
      heightCm: order.heightCm,
      codAmount: order.codAmount,
      insuranceValue: Math.min(order.codAmount, 5_000_000),
      content: order.product.title,
      requiredNote,
      paymentTypeId: order.shopPaysShipping ? 1 : 2,
      clientOrderCode: order.id,
      items: [{ name: order.product.title, quantity: 1 }],
    });

    await prisma.order.update({
      where: { id: orderId },
      data: {
        ghnOrderCode: result.order_code,
        shippingFee: result.total_fee,
        expectedDeliveryAt: result.expected_delivery_time ? new Date(result.expected_delivery_time) : null,
        status: "SHIPPING",
      },
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Tạo vận đơn GHN thất bại." };
  }

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  return { ok: true };
}

export async function refreshGhnStatus(orderId: string): Promise<GhnActionResult> {
  const session = await requireAdmin();
  try {
    await assertOwnsOrder(session.user.id, session.user.role, orderId);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Không có quyền." };
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order?.ghnOrderCode) return { ok: false, error: "Đơn này chưa có vận đơn GHN." };

  try {
    const detail = await getGhnOrderDetail(order.ghnOrderCode);
    await prisma.order.update({
      where: { id: orderId },
      data: {
        ghnStatus: detail.status,
        status: detail.status === "delivered" ? "DELIVERED" : order.status,
      },
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Không lấy được trạng thái GHN." };
  }

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  return { ok: true };
}

export async function cancelOrder(orderId: string): Promise<GhnActionResult> {
  const session = await requireAdmin();
  try {
    await assertOwnsOrder(session.user.id, session.user.role, orderId);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Không có quyền." };
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, error: "Không tìm thấy đơn hàng." };

  if (order.ghnOrderCode && order.status === "SHIPPING") {
    try {
      await cancelGhnOrder(order.ghnOrderCode);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Huỷ vận đơn GHN thất bại." };
    }
  }

  await prisma.order.update({ where: { id: orderId }, data: { status: "CANCELLED" } });

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  return { ok: true };
}
