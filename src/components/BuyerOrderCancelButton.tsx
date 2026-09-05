"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cancelOrder } from "@/lib/actions/orders";

// Cho phép người mua tự huỷ đơn CỦA CHÍNH MÌNH lúc còn "mới tạo" (chưa lấy hàng) — server
// action cancelOrder tự kiểm tra quyền (seller/SUPERADMIN/chính buyer của đơn) + điều kiện
// isOrderCancellable, component này chỉ lo UI xác nhận + hiển thị lỗi.
export function BuyerOrderCancelButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    if (!window.confirm("Huỷ đơn hàng này?")) return;
    setPending(true);
    setError(null);
    const res = await cancelOrder(orderId);
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={handleCancel}
        className="self-start rounded-md border border-red-200 bg-red-50/50 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
      >
        {pending ? "Đang huỷ..." : "Huỷ đơn"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
