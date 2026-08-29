"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AUCTION_STATE_LABEL, formatVND, type AuctionState } from "@/lib/auction";
import { bulkSetEndTime } from "@/lib/actions/products";
import type { ProductStatus } from "@/generated/prisma/client";

export type ProductRow = {
  id: string;
  title: string;
  sellerName: string | null;
  state: AuctionState;
  currentPrice: number;
  bidCount: number;
  topBidPhone: string | null;
  status: ProductStatus;
  markSold: () => Promise<void>;
  markCancelled: () => Promise<void>;
  markActive: () => Promise<void>;
};

// Chọn nhiều sản phẩm (checkbox từng dòng + chọn tất cả) rồi đặt chung 1 thời gian kết thúc
// đấu giá — dùng cho trường hợp gộp nhiều sản phẩm vào cùng 1 đợt kết thúc đồng loạt, xem
// bulkSetEndTime ở lib/actions/products.ts.
export function ProductsTable({ rows, isSuperAdmin }: { rows: ProductRow[]; isSuperAdmin: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [endTime, setEndTime] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))));
  }

  async function handleApply() {
    if (!endTime || selected.size === 0) return;
    setPending(true);
    setError(null);
    const res = await bulkSetEndTime(Array.from(selected), endTime);
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSelected(new Set());
    setEndTime("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {selected.size > 0 && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-accent-300 bg-accent-100/40 p-3">
          <span className="text-sm font-medium text-text">Đã chọn {selected.size} sản phẩm</span>
          <div className="flex flex-col gap-1">
            <label htmlFor="bulkEndTime" className="text-sm font-medium text-text">
              Đặt chung thời gian kết thúc
            </label>
            <input
              id="bulkEndTime"
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="rounded-md border border-neutral-300 bg-surface px-3 py-2 text-sm text-text focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
            />
          </div>
          <button
            type="button"
            onClick={handleApply}
            disabled={pending || !endTime}
            className="rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600 disabled:opacity-50"
          >
            {pending ? "Đang áp dụng..." : "Áp dụng"}
          </button>
          <button type="button" onClick={() => setSelected(new Set())} className="text-sm text-neutral-500 underline">
            Bỏ chọn
          </button>
          {error && <p className="w-full text-sm text-red-600">{error}</p>}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-100 text-left text-xs uppercase text-neutral-700">
            <tr>
              <th className="px-4 py-2">
                <input
                  type="checkbox"
                  checked={rows.length > 0 && selected.size === rows.length}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-neutral-300"
                  aria-label="Chọn tất cả"
                />
              </th>
              <th className="px-4 py-2">Sản phẩm</th>
              {isSuperAdmin && <th className="px-4 py-2">Người bán</th>}
              <th className="px-4 py-2">Trạng thái</th>
              <th className="px-4 py-2">Giá hiện tại</th>
              <th className="px-4 py-2">Lượt trả giá</th>
              <th className="px-4 py-2">Người trả giá cao nhất (SĐT đầy đủ)</th>
              <th className="px-4 py-2">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-2">
                  <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    onChange={() => toggleOne(row.id)}
                    className="h-4 w-4 rounded border-neutral-300"
                    aria-label={`Chọn ${row.title}`}
                  />
                </td>
                <td className="px-4 py-2">
                  <Link href={`/admin/products/${row.id}`} className="font-medium text-text hover:underline">
                    {row.title}
                  </Link>
                </td>
                {isSuperAdmin && <td className="px-4 py-2 text-neutral-700">{row.sellerName ?? "—"}</td>}
                <td className="px-4 py-2">{AUCTION_STATE_LABEL[row.state]}</td>
                <td className="px-4 py-2">{formatVND(row.currentPrice)}</td>
                <td className="px-4 py-2">{row.bidCount}</td>
                <td className="px-4 py-2">
                  {row.topBidPhone ? (
                    <span>
                      {row.topBidPhone}{" "}
                      <span className="text-xs text-neutral-500">
                        ({row.state === "BIDDING" ? "đang dẫn đầu" : "cao nhất"})
                      </span>
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-2">
                  <div className="flex min-w-[132px] flex-col gap-1.5">
                    {row.status !== "SOLD" && (
                      <form action={row.markSold}>
                        <button className="flex w-full items-center justify-center gap-1 whitespace-nowrap rounded-md border border-accent-2-300 bg-accent-2-100/50 px-2.5 py-1.5 text-xs font-medium text-accent-2-700 transition-colors hover:bg-accent-2-100">
                          <span aria-hidden="true">✓</span> Đánh dấu đã bán
                        </button>
                      </form>
                    )}
                    {row.status !== "CANCELLED" && (
                      <form action={row.markCancelled}>
                        <button className="flex w-full items-center justify-center gap-1 whitespace-nowrap rounded-md border border-red-200 bg-red-50/50 px-2.5 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50">
                          <span aria-hidden="true">✕</span> Huỷ
                        </button>
                      </form>
                    )}
                    {row.status !== "ACTIVE" && (
                      <form action={row.markActive}>
                        <button className="flex w-full items-center justify-center gap-1 whitespace-nowrap rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-100">
                          <span aria-hidden="true">↺</span> Mở lại
                        </button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
