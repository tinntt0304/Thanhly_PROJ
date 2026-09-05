"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cancelOrder } from "@/lib/actions/orders";
import { CANCEL_REASON_OPTIONS } from "@/lib/orders";

const OTHER_REASON = "__other__";

// Cho phép người mua tự huỷ đơn CỦA CHÍNH MÌNH lúc còn "mới tạo" (chưa lấy hàng) — server
// action cancelOrder tự kiểm tra quyền (seller/SUPERADMIN/chính buyer của đơn) + điều kiện
// isOrderCancellable, component này chỉ lo UI chọn lý do + xác nhận + hiển thị lỗi.
export function BuyerOrderCancelButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string>(CANCEL_REASON_OPTIONS[0]);
  const [otherReason, setOtherReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    const reason = selected === OTHER_REASON ? otherReason.trim() : selected;
    if (selected === OTHER_REASON && !reason) {
      setError("Vui lòng nhập lý do.");
      return;
    }
    setPending(true);
    setError(null);
    const res = await cancelOrder(orderId, reason);
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start rounded-md border border-red-200 bg-red-50/50 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50"
      >
        Huỷ đơn
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-red-200 bg-red-50/30 p-3">
      <p className="text-xs font-medium text-text">Vui lòng cho biết lý do huỷ đơn:</p>
      <div className="flex flex-col gap-1.5">
        {CANCEL_REASON_OPTIONS.map((reason) => (
          <label key={reason} className="flex items-center gap-2 text-xs text-neutral-700">
            <input
              type="radio"
              name={`cancel-reason-${orderId}`}
              checked={selected === reason}
              onChange={() => setSelected(reason)}
              className="h-3.5 w-3.5"
            />
            {reason}
          </label>
        ))}
        <label className="flex items-center gap-2 text-xs text-neutral-700">
          <input
            type="radio"
            name={`cancel-reason-${orderId}`}
            checked={selected === OTHER_REASON}
            onChange={() => setSelected(OTHER_REASON)}
            className="h-3.5 w-3.5"
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
            className="rounded-md border border-neutral-300 bg-surface px-2.5 py-1.5 text-xs text-text focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
          />
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={handleConfirm}
          className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
        >
          {pending ? "Đang huỷ..." : "Xác nhận huỷ đơn"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-100 disabled:opacity-50"
        >
          Đóng
        </button>
      </div>
    </div>
  );
}
