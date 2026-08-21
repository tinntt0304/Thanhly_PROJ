"use client";

import { useActionState } from "react";
import { placeBid, type BidFormState } from "@/lib/actions/bids";

const initialState: BidFormState = {};

export function BidForm({ productId, minAllowed }: { productId: string; minAllowed: number }) {
  const [state, formAction, pending] = useActionState(placeBid, initialState);

  if (state.success) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
        Đã ghi nhận mức giá của bạn! Nếu bạn thắng đấu giá, người bán sẽ liên hệ qua SĐT bạn vừa
        nhập.
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4">
      <input type="hidden" name="productId" value={productId} />
      <div className="flex flex-col gap-1">
        <label htmlFor="phone" className="text-sm font-medium">
          Số điện thoại
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          required
          placeholder="0901234567"
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="amount" className="text-sm font-medium">
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
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Đang gửi..." : "Trả giá"}
      </button>
    </form>
  );
}
