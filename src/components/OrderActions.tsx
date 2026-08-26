"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createGhnShipment, refreshGhnStatus, cancelOrder } from "@/lib/actions/orders";
import { REQUIRED_NOTE_OPTIONS, type RequiredNote } from "@/lib/ghn";
import type { OrderStatus } from "@/generated/prisma/client";

const inputClass =
  "rounded-md border border-neutral-300 bg-surface px-3 py-2 text-sm text-text focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500";

export function OrderActions({
  orderId,
  status,
  hasGhnOrderCode,
}: {
  orderId: string;
  status: OrderStatus;
  hasGhnOrderCode: boolean;
}) {
  const router = useRouter();
  const [requiredNote, setRequiredNote] = useState<RequiredNote>("KHONGCHOXEMHANG");
  const [pending, setPending] = useState<"create" | "refresh" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-neutral-200 bg-surface p-3">
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
            disabled={pending !== null}
            onClick={() => run("create", () => createGhnShipment(orderId, requiredNote))}
            className="rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600 disabled:opacity-50"
          >
            {pending === "create" ? "Đang tạo vận đơn..." : "Tạo vận đơn GHN"}
          </button>
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

      {status !== "CANCELLED" && (
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

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
