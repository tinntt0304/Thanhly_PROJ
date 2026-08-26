import type { OrderStatus } from "@/generated/prisma/client";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  NEW: "Mới tạo",
  SHIPPING: "Đang giao",
  DELIVERED: "Đã giao",
  CANCELLED: "Đã huỷ",
};

export const ORDERS_PAGE_SIZE = 30;
