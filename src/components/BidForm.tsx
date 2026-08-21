"use client";

import { useActionState } from "react";
import { placeBid, type BidFormState } from "@/lib/actions/bids";

const initialState: BidFormState = {};

const inputClass =
  "rounded-md border border-neutral-300 bg-surface px-3 py-2 text-sm text-text placeholder:text-neutral-500 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500";

export function BidForm({ productId, minAllowed }: { productId: string; minAllowed: number }) {
  const [state, formAction, pending] = useActionState(placeBid, initialState);

  if (state.success) {
    return (
      <div className="rounded-lg border border-accent-2-300 bg-accent-2-100 p-4 text-sm text-accent-2-700">
        Đã ghi nhận mức giá của bạn! Nếu bạn thắng đấu giá, người bán sẽ liên hệ qua SĐT bạn vừa
        nhập.
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-surface p-4"
    >
      <input type="hidden" name="productId" value={productId} />
      <div className="flex flex-col gap-1">
        <label htmlFor="phone" className="text-sm font-medium text-text">
          Số điện thoại
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          required
          placeholder="0901234567"
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="amount" className="text-sm font-medium text-text">
          Mức giá muốn trả (từ {minAllowed.toLocaleString("vi-VN")}đ)
        </label>
        <input
          id="amount"
          name="amount"
          type="number"
          required
          min={minAllowed}
          step={1000}
          placeholder={String(minAllowed)}
          className={inputClass}
        />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600 disabled:opacity-50"
      >
        {pending ? "Đang gửi..." : "Trả giá"}
      </button>
    </form>
  );
}
