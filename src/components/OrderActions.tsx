"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createGhnShipment,
  refreshGhnStatus,
  cancelOrder,
  getShippingQuote,
  getGhnPrintOrderUrl,
  type ShippingQuote,
} from "@/lib/actions/orders";
import { REQUIRED_NOTE_OPTIONS, type RequiredNote } from "@/lib/ghn";
import { SELLER_CANCEL_REASON_OPTIONS } from "@/lib/orders";
import { formatVND } from "@/lib/auction";
import type { OrderStatus } from "@/generated/prisma/client";

const inputClass =
  "rounded-md border border-neutral-300 bg-surface px-3 py-2 text-sm text-text focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500";

const OTHER_REASON = "__other__";

// Popup bắt buộc chọn lý do khi seller/admin huỷ đơn CHƯA gửi qua đơn vị vận chuyển (chưa có
// vận đơn GHN) — cùng cơ chế 5 lý do dựng sẵn + "Lý do khác" với BuyerOrderCancelButton phía
// người mua, nhưng hiện dạng popup (modal) thay vì panel mở rộng tại chỗ theo đúng yêu cầu.
function CancelReasonModal({
  pending,
  onConfirm,
  onClose,
}: {
  pending: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string>(SELLER_CANCEL_REASON_OPTIONS[0]);
  const [otherReason, setOtherReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    const reason = selected === OTHER_REASON ? otherReason.trim() : selected;
    if (selected === OTHER_REASON && !reason) {
      setError("Vui lòng nhập lý do.");
      return;
    }
    setError(null);
    onConfirm(reason);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4">
      <div className="flex w-full max-w-sm flex-col gap-3 rounded-lg bg-surface p-4 shadow-lg">
        <h2 className="font-heading text-sm font-bold text-text">Lý do huỷ đơn hàng</h2>
        <p className="text-xs text-neutral-500">
          Đơn chưa gửi qua đơn vị vận chuyển — vui lòng chọn lý do huỷ, người mua sẽ thấy lý do
          này.
        </p>
        <div className="flex flex-col gap-1.5">
          {SELLER_CANCEL_REASON_OPTIONS.map((reason) => (
            <label key={reason} className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="radio"
                name="seller-cancel-reason"
                checked={selected === reason}
                onChange={() => setSelected(reason)}
                className="h-4 w-4"
              />
              {reason}
            </label>
          ))}
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="radio"
              name="seller-cancel-reason"
              checked={selected === OTHER_REASON}
              onChange={() => setSelected(OTHER_REASON)}
              className="h-4 w-4"
            />
            Lý do khác
          </label>
          {selected === OTHER_REASON && (
            <input
              type="text"
              value={otherReason}
              onChange={(e) => setOtherReason(e.target.value)}
              placeholder="Nhập lý do..."
              maxLength={200}
              className={inputClass}
            />
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            disabled={pending}
            onClick={onClose}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 disabled:opacity-50"
          >
            Đóng
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={handleConfirm}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {pending ? "Đang huỷ..." : "Huỷ đơn"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function OrderActions({
  orderId,
  status,
  hasGhnOrderCode,
  cancellable,
}: {
  orderId: string;
  status: OrderStatus;
  hasGhnOrderCode: boolean;
  cancellable: boolean;
}) {
  const router = useRouter();
  const [requiredNote, setRequiredNote] = useState<RequiredNote>("KHONGCHOXEMHANG");
  const [pending, setPending] = useState<"create" | "refresh" | "cancel" | "print" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [quotes, setQuotes] = useState<ShippingQuote[] | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [loadingQuotes, setLoadingQuotes] = useState(hasGhnOrderCode ? false : true);
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Tự động lấy giá + gói vận chuyển khả dụng ngay khi vào trang (đơn đã có đủ địa
  // chỉ/cân nặng từ lúc tạo) — chỉ cần khi chưa có vận đơn, không phụ thuộc input nào của
  // người dùng nên chạy 1 lần lúc mount là đủ, không cần debounce theo input.
  useEffect(() => {
    if (hasGhnOrderCode) return;
    getShippingQuote(orderId).then((res) => {
      if (res.ok) {
        setQuotes(res.quotes);
        setSelectedServiceId(res.quotes[0]?.serviceId ?? null);
      } else {
        setQuoteError(res.error);
      }
      setLoadingQuotes(false);
    });
  }, [orderId, hasGhnOrderCode]);

  async function run(kind: "create" | "refresh" | "cancel", fn: () => Promise<{ ok: boolean; error?: string }>) {
    setPending(kind);
    setError(null);
    const res = await fn();
    setPending(null);
    if (!res.ok) {
      setError(res.error ?? "Có lỗi xảy ra.");
      return res;
    }
    router.refresh();
    return res;
  }

  async function handleCancelWithReason(reason: string) {
    const res = await run("cancel", () => cancelOrder(orderId, reason));
    if (res.ok) setShowCancelModal(false);
  }

  // Mở tab mới NGAY trong lúc bấm (không đợi await) để trình duyệt không chặn popup —
  // xin token rồi window.open sau async thường bị coi là "không phải hành động trực tiếp
  // của người dùng" và bị chặn. Mở trang trắng trước, điều hướng nó sau khi có URL thật.
  async function handlePrint() {
    setPending("print");
    setError(null);
    const printWindow = window.open("", "_blank");
    const res = await getGhnPrintOrderUrl(orderId);
    setPending(null);
    if (!res.ok) {
      printWindow?.close();
      setError(res.error);
      return;
    }
    if (printWindow) printWindow.location.href = res.url;
    else window.open(res.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex flex-col gap-3">
      {!hasGhnOrderCode && status !== "CANCELLED" && (
        <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-surface p-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text">Gói vận chuyển</span>
            {loadingQuotes ? (
              <p className="text-sm text-neutral-500">Đang tính giá vận chuyển...</p>
            ) : quoteError ? (
              <p className="text-sm text-red-600">{quoteError}</p>
            ) : quotes && quotes.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {quotes.map((q) => (
                  <label
                    key={q.serviceId}
                    className={`flex cursor-pointer items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors ${
                      selectedServiceId === q.serviceId
                        ? "border-accent-500 bg-accent-100/50"
                        : "border-neutral-200 hover:bg-neutral-50"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="ghnServiceId"
                        checked={selectedServiceId === q.serviceId}
                        onChange={() => setSelectedServiceId(q.serviceId)}
                        className="h-4 w-4"
                      />
                      {q.shortName}
                    </span>
                    <span className="font-medium text-text">{formatVND(q.fee)}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-500">Không có gói vận chuyển khả dụng cho tuyến này.</p>
            )}
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-text">Cho xem hàng</label>
              <select
                value={requiredNote}
                onChange={(e) => setRequiredNote(e.target.value as RequiredNote)}
                className={inputClass}
              >
                {REQUIRED_NOTE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              disabled={pending !== null || selectedServiceId === null}
              onClick={() => {
                const service = quotes?.find((q) => q.serviceId === selectedServiceId);
                if (!service) return;
                run("create", () => createGhnShipment(orderId, requiredNote, service.serviceId, service.serviceTypeId));
              }}
              className="rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600 disabled:opacity-50"
            >
              {pending === "create" ? "Đang tạo vận đơn..." : "Tạo vận đơn GHN"}
            </button>
          </div>
        </div>
      )}

      {hasGhnOrderCode && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending !== null}
            onClick={() => run("refresh", () => refreshGhnStatus(orderId))}
            className="self-start rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 disabled:opacity-50"
          >
            {pending === "refresh" ? "Đang làm mới..." : "Làm mới trạng thái GHN"}
          </button>
          <button
            type="button"
            disabled={pending !== null}
            onClick={handlePrint}
            className="self-start rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 disabled:opacity-50"
          >
            {pending === "print" ? "Đang tạo link in..." : "🖨️ In vận đơn"}
          </button>
        </div>
      )}

      {status !== "CANCELLED" && cancellable && (
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => {
            // Đơn chưa gửi qua đơn vị vận chuyển (chưa có vận đơn GHN) bắt buộc chọn lý do qua
            // popup — đơn đã có vận đơn GHN vẫn huỷ nhanh bằng confirm như cũ, không kèm lý do.
            if (!hasGhnOrderCode) {
              setShowCancelModal(true);
              return;
            }
            if (!window.confirm("Huỷ đơn hàng này? Nếu đã có vận đơn GHN sẽ huỷ luôn vận đơn.")) return;
            run("cancel", () => cancelOrder(orderId));
          }}
          className="self-start rounded-md border border-red-200 bg-red-50/50 px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
        >
          {pending === "cancel" ? "Đang huỷ..." : "Huỷ đơn"}
        </button>
      )}

      {status !== "CANCELLED" && !cancellable && (
        <p className="text-sm text-neutral-500">Đơn đã được lấy hàng, không huỷ được nữa.</p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {showCancelModal && (
        <CancelReasonModal
          pending={pending === "cancel"}
          onConfirm={handleCancelWithReason}
          onClose={() => setShowCancelModal(false)}
        />
      )}
    </div>
  );
}
