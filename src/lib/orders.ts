import type { OrderStatus } from "@/generated/prisma/client";
import { ghnStatusLabel, type GhnReturnRate } from "@/lib/ghn";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  NEW: "Mới tạo",
  SHIPPING: "Đang giao",
  DELIVERED: "Đã giao",
  CANCELLED: "Đã huỷ",
};

export const ORDERS_PAGE_SIZE = 30;

// Mã đơn hàng ngắn hiển thị cho người dùng (Order.orderSeq là SERIAL, tăng dần, sinh ngay lúc
// tạo đơn — xem schema.prisma) — dùng LUÔN mã này làm ClientOrderCode gửi cho GHN lúc tạo vận
// đơn (createGhnShipment) nên phải là chuỗi ổn định, không đổi ngược lại được theo thời gian.
export function formatOrderCode(orderSeq: number): string {
  return `HF${String(orderSeq).padStart(6, "0")}`;
}

// Chuẩn hoá 1 chuỗi tìm kiếm mã đơn hàng (bỏ tiền tố "HF"/số 0 đệm) về lại số orderSeq gốc —
// dùng khi tìm theo mã ở /admin/orders. Trả về null nếu chuỗi không chứa chữ số nào (không phải
// đang tìm theo mã đơn, có thể đang tìm theo tên/SĐT).
export function parseOrderCode(search: string): number | null {
  const digits = search.replace(/\D/g, "");
  if (!digits) return null;
  const seq = Number.parseInt(digits, 10);
  return Number.isNaN(seq) ? null : seq;
}

// Chỉ giữ/hiện dữ liệu đơn hàng trong 3 tháng gần nhất ở /admin/orders — luôn áp dụng ở tầng
// server (buildQuery ở listOrders), không chỉ chặn UI, để tránh quét toàn bộ lịch sử đơn hàng
// khi dữ liệu lớn dần theo thời gian. Admin vẫn lọc "Từ ngày"/"Đến ngày" trong phạm vi này được.
export const ORDERS_LOOKBACK_MONTHS = 3;

export function getOrdersLookbackFloor(): Date {
  const floor = new Date();
  floor.setMonth(floor.getMonth() - ORDERS_LOOKBACK_MONTHS);
  return floor;
}

// 5 lý do dựng sẵn cho người mua tự huỷ đơn ở /tai-khoan/don-hang — + tuỳ chọn "Lý do khác" xử
// lý riêng ở UI (hiện thêm ô nhập tự do), không nằm trong danh sách này vì giá trị thật gửi lên
// server là nội dung người mua tự gõ, không phải chuỗi "Lý do khác" cố định.
export const CANCEL_REASON_OPTIONS = [
  "Đổi ý, không muốn mua nữa",
  "Đặt nhầm sản phẩm hoặc số lượng",
  "Muốn thay đổi địa chỉ/thông tin nhận hàng",
  "Tìm được giá tốt hơn ở nơi khác",
  "Thời gian giao hàng quá lâu",
] as const;

export const MAX_CANCEL_REASON_LENGTH = 200;

// Đọc lại Order.selectedAttributes ([{name, value}]) ghi bởi buyNowAction (actions/buy-now.ts)
// khi khách chọn thuộc tính lúc bấm "Mua ngay" — không tin dữ liệu JSON thô, lọc bỏ phần tử
// sai dạng thay vì để lỗi runtime khi hiển thị ở trang chi tiết đơn.
export function parseSelectedAttributes(value: unknown): { name: string; value: string }[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (v): v is { name: string; value: string } =>
      typeof v === "object" && v !== null && typeof (v as { name?: unknown }).name === "string" && typeof (v as { value?: unknown }).value === "string"
  );
}

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

export type OrderTrackingStep = { label: string; done: boolean };
export type OrderTracking =
  | { kind: "cancelled" }
  | { kind: "steps"; steps: OrderTrackingStep[]; warning?: string; warningSeverity?: "error" | "info" };

// Rút gọn toàn bộ vòng đời đơn (OrderStatus nội bộ + ghnStatus thô, xem orderDisplayStatusLabel
// ở trên) thành 4 mốc cố định kiểu tracking Shopee cho người mua dễ theo dõi — "Đặt hàng" luôn
// xong ngay khi tạo Order, 3 mốc còn lại suy từ ghnOrderCode/ghnStatus vì hệ thống chỉ thật sự
// theo dõi được tới đó (không có mốc trung gian nào khác lưu riêng). Đơn đang hoàn/có sự cố vẫn
// hiện dạng tracking (không coi là huỷ) nhưng đổi nhãn mốc 3 + thêm dòng cảnh báo ghnStatus thật.
export function getOrderTracking(order: {
  status: OrderStatus;
  ghnOrderCode: string | null;
  ghnStatus: string | null;
  ghnStatusReason?: string | null;
}): OrderTracking {
  if (order.status === "CANCELLED") return { kind: "cancelled" };

  const ghnStatus = order.ghnStatus;
  const hasShipment = !!order.ghnOrderCode;
  const isDelivered = order.status === "DELIVERED" || ghnStatus === "delivered";
  const isShippingPhase = (!!ghnStatus && SHIPPING_GHN_STATUSES.includes(ghnStatus)) || isDelivered;
  const isReturning = !!ghnStatus && RETURNING_GHN_STATUSES.includes(ghnStatus);
  const isIssue = !!ghnStatus && ISSUE_GHN_STATUSES.includes(ghnStatus);

  const steps: OrderTrackingStep[] = [
    { label: "Đặt hàng thành công", done: true },
    { label: "Người bán xác nhận", done: hasShipment || isDelivered },
    {
      label: isReturning ? "Đang hoàn hàng" : isIssue ? "Lấy/giao hàng thất bại" : "Đang giao hàng",
      done: isShippingPhase,
    },
    { label: "Giao hàng thành công", done: isDelivered },
  ];

  // isIssue (delivery_fail/exception/damage/lost/return_fail) là lỗi CẦN CHÚ Ý ngay — hiện đỏ,
  // nổi bật hơn hẳn isReturning (đang hoàn hàng, vẫn là 1 bước bình thường trong quy trình, chỉ
  // cần biết chứ không cần lo lắng) — hiện cam/thông tin. Kèm lý do thật GHN trả về (nếu có,
  // chỉ webhook mới cung cấp — xem ghnStatusReason ở schema) ngay sau nhãn trạng thái.
  const baseWarning = (isReturning || isIssue) && ghnStatus ? ghnStatusLabel(ghnStatus) : undefined;
  const warning =
    baseWarning && order.ghnStatusReason ? `${baseWarning} — Lý do: ${order.ghnStatusReason}` : baseWarning;

  return {
    kind: "steps",
    steps,
    warning,
    warningSeverity: isIssue ? "error" : "info",
  };
}

// Từ "picking" trở đi (shipper đã bắt đầu tới lấy hàng), coi như không huỷ được nữa ở tầng
// ứng dụng — chặn ngay từ đây (không đợi GHN từ chối) để cả admin lẫn người mua đều thấy rõ lý
// do thay vì lỗi chung chung từ GHN. "ready_to_pick" (đã tạo vận đơn, đang chờ lấy hàng) vẫn coi
// là "mới tạo" nên vẫn huỷ được — đúng ranh giới GHN cho phép huỷ (shipping-order/cancel chỉ
// nhận đơn CHƯA lấy hàng).
const NOT_CANCELLABLE_GHN_STATUSES = [
  ...SHIPPING_GHN_STATUSES.filter((s) => s !== "ready_to_pick"),
  ...RETURNING_GHN_STATUSES,
  ...ISSUE_GHN_STATUSES,
  "delivered",
  "cancel",
];

export function isOrderCancellable(order: { status: OrderStatus; ghnStatus: string | null }): boolean {
  if (order.status === "CANCELLED" || order.status === "DELIVERED") return false;
  if (order.ghnStatus && NOT_CANCELLABLE_GHN_STATUSES.includes(order.ghnStatus)) return false;
  return true;
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

// Mức cảnh báo SĐT hiển thị ở OrderForm — gộp tỉ lệ hoàn hàng GHN (etl/return-rate, xem
// getReturnRate ở ghn.ts) với số lượt seller tự báo xấu SĐT (PhoneReport). Tỉ lệ hoàn của
// GHN có thể chưa phản ánh đúng thực tế (theo phản hồi người dùng) — báo xấu cho phép cộng
// đồng seller tự nâng mức cảnh báo lên mà không cần chờ GHN cập nhật lại tỉ lệ của họ.
const RETURN_RATE_LEVEL_ORDER = ["level_1", "level_2", "level_3", "level_4"];
export const RETURN_RATE_LEVEL_LABEL: Record<string, string> = {
  level_1: "An toàn",
  level_2: "Rủi ro thấp",
  level_3: "Rủi ro cao",
  level_4: "Nguy hiểm",
};

// Ngưỡng suy ra mức cảnh báo tối thiểu từ riêng số lượt báo xấu (không cần dữ liệu GHN):
// 1-2 lượt -> ít nhất "Rủi ro thấp", 3-4 lượt -> ít nhất "Rủi ro cao", >=5 lượt -> "Nguy hiểm".
function levelFromReportCount(reportCount: number): string | null {
  if (reportCount >= 5) return "level_4";
  if (reportCount >= 3) return "level_3";
  if (reportCount >= 1) return "level_2";
  return null;
}

export type PhoneRiskDisplay = {
  levelCode: string;
  level: string;
  rate: number | null; // tỉ lệ hoàn % theo GHN — null nếu không lấy được từ GHN (dùng riêng dữ liệu báo xấu)
  reportCount: number;
};

// null nếu không có cả dữ liệu GHN lẫn lượt báo xấu nào — không có gì để hiển thị.
export function combinePhoneRisk(ghn: GhnReturnRate | null, reportCount: number): PhoneRiskDisplay | null {
  const reportLevel = levelFromReportCount(reportCount);
  if (!ghn && !reportLevel) return null;
  if (!ghn) {
    return { levelCode: reportLevel!, level: RETURN_RATE_LEVEL_LABEL[reportLevel!], rate: null, reportCount };
  }
  if (!reportLevel) {
    return { levelCode: ghn.levelCode, level: ghn.level, rate: ghn.rate, reportCount };
  }
  // Lấy mức nặng hơn giữa 2 nguồn — báo xấu chỉ có thể ĐẨY cảnh báo lên, không bao giờ hạ
  // xuống dưới mức GHN tự báo.
  const worseCode =
    RETURN_RATE_LEVEL_ORDER.indexOf(reportLevel) > RETURN_RATE_LEVEL_ORDER.indexOf(ghn.levelCode)
      ? reportLevel
      : ghn.levelCode;
  return {
    levelCode: worseCode,
    level: RETURN_RATE_LEVEL_LABEL[worseCode] ?? ghn.level,
    rate: ghn.rate,
    reportCount,
  };
}
