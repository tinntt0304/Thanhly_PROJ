import type { OrderStatus } from "@/generated/prisma/client";
import { ghnStatusLabel } from "@/lib/ghn";

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

// Nhãn trạng thái hiển thị cho người dùng — ưu tiên trạng thái GHN thật (đã tạo vận đơn) thay
// vì OrderStatus nội bộ, vì OrderStatus chỉ có 4 mức (NEW/SHIPPING/DELIVERED/CANCELLED) nên
// không phản ánh được các trạng thái GHN như "Thất lạc"/"Đang hoàn hàng" — dùng chung giữa
// trang danh sách (/admin/orders) và trang chi tiết đơn để tránh lệch nhau.
export function orderDisplayStatusLabel(order: {
  status: OrderStatus;
  ghnOrderCode: string | null;
  ghnStatus: string | null;
}): string {
  if (order.ghnOrderCode) {
    return order.ghnStatus ? ghnStatusLabel(order.ghnStatus) : "Đã tạo vận đơn — chưa cập nhật";
  }
  return order.status === "CANCELLED" ? "Đã huỷ" : "Chưa tạo vận đơn";
}

// GHN có 1 trang tài liệu riêng "Update fields according to order status" (docs id 117)
// nhưng trang đó render bằng JS, không lấy được nội dung bảng thật để chép chính xác —
// quy tắc tô xám dưới đây dựa trên 2 mốc GHN xác nhận rõ ràng ở chỗ khác:
// 1) Từ "picked" (đã lấy hàng) trở đi, shipper đã cầm kiện hàng vật lý thật — thông tin
//    người nhận/địa chỉ và kích thước-cân nặng gắn với đúng kiện đó không còn sửa được nữa.
// 2) Tiền thu hộ (COD)/ghi chú vẫn sửa được xa hơn (GHN FAQ xác nhận COD sửa được tới hết
//    giai đoạn lưu kho/trung chuyển/phân loại/giao thất bại/chờ trả hàng), chỉ khoá khi đơn
//    đã bước vào "đang giao" (đang giao tận tay, không sửa được số tiền thu giữa chừng) trở
//    đi, hoặc đã rẽ nhánh hoàn/sự cố/huỷ.
// Đây chỉ là rào UI (gợi ý, tô xám) — an toàn cuối cùng vẫn là lỗi thật GHN trả về khi gọi
// shipping-order/update (xem updateGhnOrder ở ghn.ts), không phải rào này.
const GHN_RECIPIENT_LOCKED_STATUSES = [
  "picked",
  "storing",
  "transporting",
  "sorting",
  "delivering",
  "money_collect_delivering",
  "delivered",
  "delivery_fail",
  "waiting_to_return",
  "return",
  "returned",
  "return_fail",
  "exception",
  "damage",
  "lost",
  "cancel",
];
const GHN_COD_LOCKED_STATUSES = [
  "delivering",
  "money_collect_delivering",
  "delivered",
  "return",
  "returned",
  "return_fail",
  "exception",
  "damage",
  "lost",
  "cancel",
];

export type OrderFieldLocks = { recipient: boolean; cod: boolean };

export function getOrderFieldLocks(ghnStatus: string | null): OrderFieldLocks {
  return {
    recipient: !!ghnStatus && GHN_RECIPIENT_LOCKED_STATUSES.includes(ghnStatus),
    cod: !!ghnStatus && GHN_COD_LOCKED_STATUSES.includes(ghnStatus),
  };
}
