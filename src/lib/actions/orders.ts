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
  getAvailableServices,
  getShippingFee,
  createGhnOrder,
  updateGhnOrder,
  getGhnOrderDetail,
  cancelGhnOrder,
  REQUIRED_NOTE_OPTIONS,
  type RequiredNote,
  type GhnProvince,
  type GhnDistrict,
  type GhnWard,
  type GhnService,
} from "@/lib/ghn";
import {
  ORDERS_PAGE_SIZE,
  deriveOrderStatusFromGhn,
  ORDER_LIST_TABS,
  SHIPPING_GHN_STATUSES,
  RETURNING_GHN_STATUSES,
  ISSUE_GHN_STATUSES,
  type OrderListTab,
} from "@/lib/orders";
import type { Prisma } from "@/generated/prisma/client";

// ===== Tra cứu tỉnh/quận/phường GHN — dùng cho AddressPicker ở form tạo đơn =====
// Chỉ cần đăng nhập (không cần quyền đặc biệt), bọc lại thành server action vì
// GHN_TOKEN chỉ có ở server, client không được gọi thẳng API GHN.
//
// PHẢI bắt lỗi ở đây và trả về {ok:false, error} thay vì để throw xuyên qua ranh giới
// Server Action: Next.js production tự động che thông báo lỗi thật của mọi throw không
// bắt trong Server Action (chỉ còn "Minified React error #441" phía client, không đọc
// được lý do) — im ắng làm lộ vấn đề rất khó debug. Đây là quy ước bắt buộc cho MỌI
// server action gọi ra ngoài (Apify/SePay/GHN) trong dự án, xem searchFacebookGroups.
async function safeGhnCall<T>(fn: () => Promise<T>): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gọi API GHN thất bại." };
  }
}

export async function getGhnProvinces(): Promise<{ ok: true; data: GhnProvince[] } | { ok: false; error: string }> {
  await requireAdmin();
  return safeGhnCall(ghnGetProvinces);
}

export async function getGhnDistricts(
  provinceId: number
): Promise<{ ok: true; data: GhnDistrict[] } | { ok: false; error: string }> {
  await requireAdmin();
  return safeGhnCall(() => ghnGetDistricts(provinceId));
}

export async function getGhnWards(
  districtId: number
): Promise<{ ok: true; data: GhnWard[] } | { ok: false; error: string }> {
  await requireAdmin();
  return safeGhnCall(() => ghnGetWards(districtId));
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

// success chỉ dùng ở updateOrder (createOrder redirect luôn khi xong, không cần) — gộp
// chung 1 type để OrderForm.tsx dùng lại được cho cả 2 action, không cần 2 kiểu tách rời.
export type OrderFormState = { error?: string; success?: boolean };

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

// Sửa thông tin đơn đã tạo (tên/SĐT/địa chỉ người nhận, COD, cân nặng/kích thước, ghi
// chú...). GHN không nêu rõ tới trạng thái nào thì hết cho sửa — cứ gọi shipping-order/update
// nếu đơn đã có vận đơn và để GHN tự trả lỗi thật nếu không cho sửa nữa (không đoán trước),
// CHỈ lưu vào DB nội bộ sau khi GHN xác nhận cập nhật thành công để 2 bên luôn khớp nhau.
export async function updateOrder(
  orderId: string,
  _prevState: OrderFormState | undefined,
  formData: FormData
): Promise<OrderFormState> {
  const session = await requireAdmin();
  try {
    await assertOwnsOrder(session.user.id, session.user.role, orderId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Không có quyền." };
  }

  const existing = await prisma.order.findUnique({ where: { id: orderId }, include: { product: true } });
  if (!existing) return { error: "Không tìm thấy đơn hàng." };
  if (existing.status === "CANCELLED") return { error: "Đơn đã huỷ, không sửa được nữa." };

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

  if (existing.ghnOrderCode) {
    try {
      await updateGhnOrder({
        orderCode: existing.ghnOrderCode,
        toName: data.buyerName,
        toPhone: data.buyerPhone,
        toAddress: data.buyerAddress,
        toWardCode: data.wardCode,
        toDistrictId: data.districtId,
        weightGram: data.weightGram,
        lengthCm: data.lengthCm,
        widthCm: data.widthCm,
        heightCm: data.heightCm,
        codAmount: data.codAmount,
        insuranceValue: Math.min(data.codAmount, 5_000_000),
        content: existing.product.title,
        paymentTypeId: data.shopPaysShipping ? 1 : 2,
        note: data.note,
      });
    } catch (e) {
      return { error: e instanceof Error ? e.message : "GHN từ chối cập nhật đơn (có thể đã qua giai đoạn cho sửa)." };
    }
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
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

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  return { success: true };
}

// Where clause riêng cho từng tab — theo tinh thần tab trạng thái nhiều nấc của GHN
// Dashboard, xem giải thích đầy đủ ở ORDER_LIST_TABS (src/lib/orders.ts).
function buildTabWhere(tab: OrderListTab): Prisma.OrderWhereInput {
  switch (tab) {
    case "NOT_SHIPPED":
      return { ghnOrderCode: null, status: { not: "CANCELLED" } };
    case "SHIPPING":
      return { ghnStatus: { in: SHIPPING_GHN_STATUSES } };
    case "RETURNING":
      return { ghnStatus: { in: RETURNING_GHN_STATUSES } };
    case "ISSUE":
      return { ghnStatus: { in: ISSUE_GHN_STATUSES } };
    case "DELIVERED":
      return { status: "DELIVERED" };
    case "CANCELLED":
      return { status: "CANCELLED" };
    case "ALL":
    default:
      return {};
  }
}

export type OrderListItem = Awaited<ReturnType<typeof listOrders>>["items"][number];

export async function listOrders(
  page: number = 1,
  tab: OrderListTab = "ALL",
  dateFrom?: string,
  dateTo?: string
) {
  const session = await requireAdmin();
  const isSuperAdmin = session.user.role === "SUPERADMIN";
  const safePage = Math.max(1, Math.trunc(page) || 1);

  const baseWhere: Prisma.OrderWhereInput = isSuperAdmin ? {} : { sellerId: session.user.id };

  const createdAtFilter: Prisma.DateTimeFilter = {};
  if (dateFrom) createdAtFilter.gte = new Date(`${dateFrom}T00:00:00`);
  if (dateTo) createdAtFilter.lte = new Date(`${dateTo}T23:59:59.999`);
  const createdAtWhere: Prisma.OrderWhereInput =
    dateFrom || dateTo ? { createdAt: createdAtFilter } : {};

  const where: Prisma.OrderWhereInput = { ...baseWhere, ...createdAtWhere, ...buildTabWhere(tab) };

  const [items, totalCount, tabCountEntries] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * ORDERS_PAGE_SIZE,
      take: ORDERS_PAGE_SIZE,
      include: { product: { select: { title: true } }, seller: { select: { name: true } } },
    }),
    prisma.order.count({ where }),
    Promise.all(
      ORDER_LIST_TABS.map(async (t) => [
        t.key,
        await prisma.order.count({ where: { ...baseWhere, ...createdAtWhere, ...buildTabWhere(t.key) } }),
      ] as const)
    ),
  ]);

  return {
    items,
    totalCount,
    page: safePage,
    pageSize: ORDERS_PAGE_SIZE,
    tabCounts: Object.fromEntries(tabCountEntries) as Record<OrderListTab, number>,
  };
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

export type ShippingQuote = GhnService & { fee: number };
export type ShippingQuoteResult = { ok: true; quotes: ShippingQuote[] } | { ok: false; error: string };

// Tự động tính phí cho từng gói GHN khả dụng trên tuyến giao của đơn này — dùng luôn địa
// chỉ/cân nặng đã lưu trên Order (đã đủ ngay từ lúc tạo đơn), không cần người dùng bấm gì
// thêm trước khi thấy giá.
export async function getShippingQuote(orderId: string): Promise<ShippingQuoteResult> {
  const session = await requireAdmin();
  try {
    await assertOwnsOrder(session.user.id, session.user.role, orderId);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Không có quyền." };
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, error: "Không tìm thấy đơn hàng." };

  try {
    const services = await getAvailableServices(order.districtId);
    const insuranceValue = Math.min(order.codAmount, 5_000_000);
    const quotes = await Promise.all(
      services.map(async (s) => ({
        ...s,
        fee: await getShippingFee({
          toDistrictId: order.districtId,
          toWardCode: order.wardCode,
          serviceId: s.serviceId,
          weightGram: order.weightGram,
          lengthCm: order.lengthCm,
          widthCm: order.widthCm,
          heightCm: order.heightCm,
          insuranceValue,
        }),
      }))
    );
    quotes.sort((a, b) => a.fee - b.fee);
    return { ok: true, quotes };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Không lấy được giá vận chuyển GHN." };
  }
}

export type GhnActionResult = { ok: true } | { ok: false; error: string };

export async function createGhnShipment(
  orderId: string,
  requiredNote: RequiredNote,
  serviceId: number,
  serviceTypeId: number
): Promise<GhnActionResult> {
  const session = await requireAdmin();
  try {
    await assertOwnsOrder(session.user.id, session.user.role, orderId);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Không có quyền." };
  }
  if (!REQUIRED_NOTE_OPTIONS.some((o) => o.value === requiredNote)) {
    return { ok: false, error: "Tuỳ chọn xem hàng không hợp lệ." };
  }
  if (!Number.isInteger(serviceId) || !Number.isInteger(serviceTypeId)) {
    return { ok: false, error: "Chưa chọn gói vận chuyển." };
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
      serviceId,
      serviceTypeId,
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
        status: deriveOrderStatusFromGhn(detail.status, order.status),
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
