"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createGhnShipment,
  refreshGhnStatus,
  cancelOrder,
  getShippingQuote,
  type ShippingQuote,
} from "@/lib/actions/orders";
import { REQUIRED_NOTE_OPTIONS, type RequiredNote } from "@/lib/ghn";
import { formatVND } from "@/lib/auction";
import type { OrderStatus } from "@/generated/prisma/client";

const inputClass =
  "rounded-md border border-neutral-300 bg-surface px-3 py-2 text-sm text-text focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500";

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
  const [pending, setPending] = useState<"create" | "refresh" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [quotes, setQuotes] = useState<ShippingQuote[] | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [loadingQuotes, setLoadingQuotes] = useState(hasGhnOrderCode ? false : true);
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);

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
      return;
    }
    router.refresh();
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
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => run("refresh", () => refreshGhnStatus(orderId))}
          className="self-start rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 disabled:opacity-50"
        >
          {pending === "refresh" ? "Đang làm mới..." : "Làm mới trạng thái GHN"}
        </button>
      )}

      {status !== "CANCELLED" && cancellable && (
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => {
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
    </div>
  );
}
