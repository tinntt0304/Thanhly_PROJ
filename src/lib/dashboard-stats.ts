import { prisma } from "@/lib/prisma";
import type { OrderStatus } from "@/generated/prisma/client";

// Chỉ hiện tối đa N sản phẩm bán chạy nhất — đủ để nhìn nhanh xu hướng mà không tràn trang.
const TOP_SELLING_LIMIT = 5;

export type DashboardStats = {
  products: {
    total: number;
    bidding: number; // ACTIVE + còn trong thời gian đấu giá (endTime > hiện tại)
    endedUnresolved: number; // ACTIVE nhưng đã hết giờ, chưa đánh dấu Đã bán/Đã huỷ
    sold: number;
    cancelled: number;
  };
  orders: {
    total: number;
    byStatus: Record<OrderStatus, number>;
    deliveredRevenue: number; // tổng codAmount (giá trị hàng, chưa gồm phí ship) các đơn ĐÃ GIAO
  };
  topSelling: Array<{
    productId: string;
    title: string;
    image: string | null;
    quantitySold: number;
  }>;
};

// SUPERADMIN xem thống kê TOÀN SÀN (mọi seller); SELLER chỉ xem thống kê của chính mình — cùng
// quy ước phân quyền đã dùng ở trang "Danh sách sản phẩm" (/admin) và "Quản lý đơn hàng".
export async function getDashboardStats(sellerId: string, isSuperAdmin: boolean): Promise<DashboardStats> {
  const productWhere = isSuperAdmin ? {} : { sellerId };
  const orderWhere = isSuperAdmin ? {} : { sellerId };

  const [productStatusCounts, biddingCount, orderStatusCounts, deliveredAgg, topSellingGroups] = await Promise.all([
    prisma.product.groupBy({ by: ["status"], where: productWhere, _count: { _all: true } }),
    prisma.product.count({ where: { ...productWhere, status: "ACTIVE", endTime: { gt: new Date() } } }),
    prisma.order.groupBy({ by: ["status"], where: orderWhere, _count: { _all: true } }),
    prisma.order.aggregate({ where: { ...orderWhere, status: "DELIVERED" }, _sum: { codAmount: true } }),
    // "Bán chạy" tính theo TỔNG SỐ LƯỢNG đã đặt qua đơn hàng (OrderItem.quantity), loại đơn đã
    // huỷ — không tính theo Product.status=SOLD vì đó chỉ là cờ đánh dấu thủ công cho đấu giá,
    // không phản ánh số lượng thực bán qua nhiều lượt mua (Mua ngay/giỏ hàng nhiều số lượng).
    prisma.orderItem.groupBy({
      by: ["productId"],
      where: { order: { ...orderWhere, status: { not: "CANCELLED" } } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: TOP_SELLING_LIMIT,
    }),
  ]);

  const totalProducts = productStatusCounts.reduce((sum, s) => sum + s._count._all, 0);
  const soldCount = productStatusCounts.find((s) => s.status === "SOLD")?._count._all ?? 0;
  const cancelledCount = productStatusCounts.find((s) => s.status === "CANCELLED")?._count._all ?? 0;
  const activeCount = productStatusCounts.find((s) => s.status === "ACTIVE")?._count._all ?? 0;
  const endedUnresolved = Math.max(0, activeCount - biddingCount);

  const orderByStatus: Record<OrderStatus, number> = { NEW: 0, SHIPPING: 0, DELIVERED: 0, CANCELLED: 0 };
  let totalOrders = 0;
  for (const row of orderStatusCounts) {
    orderByStatus[row.status] = row._count._all;
    totalOrders += row._count._all;
  }

  const topProductIds = topSellingGroups.map((g) => g.productId);
  const topProducts = topProductIds.length
    ? await prisma.product.findMany({
        where: { id: { in: topProductIds } },
        select: { id: true, title: true, images: true },
      })
    : [];
  const productById = new Map(topProducts.map((p) => [p.id, p]));

  const topSelling = topSellingGroups.flatMap((g) => {
    const product = productById.get(g.productId);
    if (!product) return []; // sản phẩm đã bị xoá — bỏ qua thay vì hiện dòng trống
    return [{ productId: g.productId, title: product.title, image: product.images[0] ?? null, quantitySold: g._sum.quantity ?? 0 }];
  });

  return {
    products: { total: totalProducts, bidding: biddingCount, endedUnresolved, sold: soldCount, cancelled: cancelledCount },
    orders: { total: totalOrders, byStatus: orderByStatus, deliveredRevenue: deliveredAgg._sum.codAmount ?? 0 },
    topSelling,
  };
}
