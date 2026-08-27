import type { OrderStatus } from "@/generated/prisma/client";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  NEW: "Mới tạo",
  SHIPPING: "Đang giao",
  DELIVERED: "Đã giao",
  CANCELLED: "Đã huỷ",
};

export const ORDERS_PAGE_SIZE = 30;

// Tab lọc trạng thái ở trang danh sách đơn (/admin/orders) — theo tinh thần tab trạng thái
// nhiều nấc của GHN Dashboard (Đang giao / Đang hoàn hàng / Chờ xác nhận giao lại...),
// nhưng đơn giản hoá theo đúng dữ liệu hệ thống này thật sự theo dõi được: OrderStatus nội
// bộ (NEW/SHIPPING/DELIVERED/CANCELLED) + ghnStatus thô từ GHN khi đã có vận đơn.
export type OrderListTab = "ALL" | "NOT_SHIPPED" | "SHIPPING" | "RETURNING" | "ISSUE" | "DELIVERED" | "CANCELLED";

export const ORDER_LIST_TABS: { key: OrderListTab; label: string }[] = [
  { key: "ALL", label: "Tất cả" },
  { key: "NOT_SHIPPED", label: "Chưa tạo vận đơn" },
  { key: "SHIPPING", label: "Đang giao" },
  { key: "RETURNING", label: "Đang hoàn hàng" },
  { key: "ISSUE", label: "Có vấn đề" },
  { key: "DELIVERED", label: "Đã giao" },
  { key: "CANCELLED", label: "Đã huỷ" },
];

// Gom nhóm các ghnStatus thô (xem GHN_STATUS_LABEL ở src/lib/ghn.ts) theo tinh thần tab của
// GHN — dùng ở buildOrderListWhere (actions/orders.ts) để lọc.
export const SHIPPING_GHN_STATUSES = [
  "ready_to_pick",
  "picking",
  "money_collect_picking",
  "picked",
  "storing",
  "transporting",
  "sorting",
  "delivering",
  "money_collect_delivering",
];
export const RETURNING_GHN_STATUSES = ["waiting_to_return", "return", "returned"];
export const ISSUE_GHN_STATUSES = ["delivery_fail", "exception", "damage", "lost", "return_fail"];

// Dùng chung giữa "Làm mới trạng thái GHN" (thao tác thủ công, actions/orders.ts) và
// webhook GHN (server tự đẩy về, api/webhooks/ghn) để 2 đường cập nhật trạng thái luôn
// đồng nhất — chỉ "delivered" mới coi là giao xong, các trạng thái khác giữ nguyên status
// nội bộ hiện tại (đơn có thể đang SHIPPING hoặc đã CANCELLED thủ công từ trước).
export function deriveOrderStatusFromGhn(ghnStatus: string, currentStatus: OrderStatus): OrderStatus {
  return ghnStatus === "delivered" ? "DELIVERED" : currentStatus;
}
