"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { ORDERS_PAGE_SIZE } from "@/lib/orders";

export type MyOrderListItem = Awaited<ReturnType<typeof listMyOrders>>["items"][number];

// Mirror listOrders (actions/orders.ts) nhưng scope theo buyerId thay vì sellerId — chỉ đọc,
// không có tab/thao tác sửa như bản admin (buyer không sửa được đơn của mình).
export async function listMyOrders(page: number = 1) {
  const session = await requireAdmin();
  const safePage = Math.max(1, Math.trunc(page) || 1);
  const where = { buyerId: session.user.id };

  const [items, totalCount] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * ORDERS_PAGE_SIZE,
      take: ORDERS_PAGE_SIZE,
      include: { items: { include: { product: { select: { title: true, images: true } } } } },
    }),
    prisma.order.count({ where }),
  ]);

  return { items, totalCount, page: safePage, pageSize: ORDERS_PAGE_SIZE };
}

// Đơn vừa checkout xong — hiện ở trang xác nhận /gio-hang/thanh-cong, scope theo buyerId để
// buyer này không xem được order của người khác dù biết id.
export async function getMyOrders(orderIds: string[]) {
  const session = await requireAdmin();
  if (orderIds.length === 0) return [];
  return prisma.order.findMany({
    where: { id: { in: orderIds }, buyerId: session.user.id },
    include: { items: { include: { product: { select: { title: true, images: true } } } } },
  });
}

export type MyActiveBid = {
  productId: string;
  productTitle: string;
  productImage: string | null;
  currentPrice: number;
  myBestAmount: number;
  isWinning: boolean;
  endTime: Date;
  status: string;
};

// Danh sách "Đang đấu giá" ở /gio-hang — suy trực tiếp từ Bid.buyerId, KHÔNG phải giỏ hàng
// (không có thao tác thêm/xoá thủ công) vì giá đấu giá luôn thay đổi, không "chốt" được để bỏ
// giỏ. Khối lượng bid/sản phẩm nhỏ nên tính isWinning/myBest trong JS thay vì SQL phức tạp.
export async function listMyActiveBids(): Promise<MyActiveBid[]> {
  const session = await requireAdmin();

  const products = await prisma.product.findMany({
    where: { bids: { some: { buyerId: session.user.id } } },
    include: { bids: { orderBy: { amount: "desc" } } },
    orderBy: { endTime: "asc" },
  });

  return products.map((product) => {
    const topBid = product.bids[0] ?? null;
    const myBids = product.bids.filter((b) => b.buyerId === session.user.id);
    const myBest = myBids.reduce((max, b) => (b.amount > max.amount ? b : max), myBids[0]);

    return {
      productId: product.id,
      productTitle: product.title,
      productImage: product.images[0] ?? null,
      currentPrice: product.currentPrice,
      myBestAmount: myBest.amount,
      isWinning: !!topBid && topBid.id === myBest.id,
      endTime: product.endTime,
      status: product.status,
    };
  });
}
