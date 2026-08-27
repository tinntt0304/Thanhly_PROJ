import type { OrderStatus } from "@/generated/prisma/client";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  NEW: "Mới tạo",
  SHIPPING: "Đang giao",
  DELIVERED: "Đã giao",
  CANCELLED: "Đã huỷ",
};

export const ORDERS_PAGE_SIZE = 30;

// Dùng chung giữa "Làm mới trạng thái GHN" (thao tác thủ công, actions/orders.ts) và
// webhook GHN (server tự đẩy về, api/webhooks/ghn) để 2 đường cập nhật trạng thái luôn
// đồng nhất — chỉ "delivered" mới coi là giao xong, các trạng thái khác giữ nguyên status
// nội bộ hiện tại (đơn có thể đang SHIPPING hoặc đã CANCELLED thủ công từ trước).
export function deriveOrderStatusFromGhn(ghnStatus: string, currentStatus: OrderStatus): OrderStatus {
  return ghnStatus === "delivered" ? "DELIVERED" : currentStatus;
}
