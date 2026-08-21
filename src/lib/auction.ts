import type { Bid, Product, ProductStatus } from "@/generated/prisma/client";

export type AuctionState =
  | "BIDDING" // đang mở, còn trong thời gian đấu giá
  | "ENDED_AWAITING_CONTACT" // hết giờ, có người thắng, chờ người bán liên hệ
  | "UNSOLD" // hết giờ, không ai trả giá
  | "SOLD" // người bán đã đánh dấu đã bán
  | "CANCELLED"; // người bán đã huỷ

/**
 * Trạng thái phiên đấu giá được SUY RA từ status + endTime + có bid hay không,
 * không lưu trực tiếp trong DB — tránh cần một cron job chạy nền để "đóng" phiên (P0.3).
 */
export function getAuctionState(
  product: Pick<Product, "status" | "endTime">,
  hasBids: boolean
): AuctionState {
  if (product.status === "SOLD") return "SOLD";
  if (product.status === "CANCELLED") return "CANCELLED";

  const hasEnded = Date.now() >= product.endTime.getTime();
  if (!hasEnded) return "BIDDING";

  return hasBids ? "ENDED_AWAITING_CONTACT" : "UNSOLD";
}

export function isBiddingOpen(state: AuctionState): boolean {
  return state === "BIDDING";
}

/**
 * Ẩn một phần SĐT khi hiển thị công khai, ví dụ "0901234567" -> "090***567".
 * Giữ nguyên PRD ví dụ: 3 ký tự đầu, 3 ký tự cuối, "***" ở giữa.
 */
export function maskPhone(phone: string): string {
  const digits = phone.trim();
  if (digits.length <= 6) return `${digits.slice(0, 2)}***`;
  return `${digits.slice(0, 3)}***${digits.slice(-3)}`;
}

export function formatVND(amount: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function getWinningBid(bids: Bid[]): Bid | null {
  if (bids.length === 0) return null;
  return [...bids].sort((a, b) => {
    if (b.amount !== a.amount) return b.amount - a.amount;
    return a.createdAt.getTime() - b.createdAt.getTime();
  })[0];
}

export function minNextBid(product: Pick<Product, "currentPrice" | "minBidStep">): number {
  return product.currentPrice + product.minBidStep;
}

export const PRODUCT_STATUS_LABEL: Record<ProductStatus, string> = {
  ACTIVE: "Đang diễn ra",
  SOLD: "Đã bán",
  CANCELLED: "Đã huỷ",
};

export const AUCTION_STATE_LABEL: Record<AuctionState, string> = {
  BIDDING: "Đang đấu giá",
  ENDED_AWAITING_CONTACT: "Đã kết thúc — chờ liên hệ",
  UNSOLD: "Chưa bán",
  SOLD: "Đã bán",
  CANCELLED: "Đã huỷ",
};
