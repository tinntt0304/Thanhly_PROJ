"use client";

import { useActionState } from "react";
import { updatePricePerResult, type PricingFormState } from "@/lib/actions/credits";

const initialState: PricingFormState = {};

export function PricingConfigForm({ pricePerResult }: { pricePerResult: number }) {
  const [state, formAction, pending] = useActionState(updatePricePerResult, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="pricePerResult" className="text-sm font-medium text-text">
          Giá bán mỗi kết quả (VNĐ)
        </label>
        <input
          id="pricePerResult"
          name="pricePerResult"
          type="number"
          min={1}
          defaultValue={pricePerResult}
          required
          className="w-40 rounded-md border border-neutral-300 bg-surface px-3 py-2 text-sm text-text focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-50"
      >
        {pending ? "Đang lưu..." : "Lưu giá"}
      </button>
      {state.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
      <p className="w-full text-xs text-neutral-500">
        Tham khảo: Apify tính ~$4.99/1.000 kết quả (~130đ/kết quả, chưa gồm phí nền tảng biến
        động) — nên đặt giá bán cao hơn để có biên độ.
      </p>
    </form>
  );
}
