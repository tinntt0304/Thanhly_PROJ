"use client";

import { useActionState } from "react";
import { updateMaxTopUpAmount, type MaxTopUpFormState } from "@/lib/actions/credits";

const initialState: MaxTopUpFormState = {};

export function TopUpLimitForm({ maxTopUpAmount }: { maxTopUpAmount: number | null }) {
  const [state, formAction, pending] = useActionState(updateMaxTopUpAmount, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="maxTopUpAmount" className="text-sm font-medium text-text">
          Số tiền nạp tối đa mỗi lượt (VNĐ)
        </label>
        <input
          id="maxTopUpAmount"
          name="maxTopUpAmount"
          type="number"
          min={1}
          defaultValue={maxTopUpAmount ?? ""}
          placeholder="Để trống = không giới hạn"
          className="w-56 rounded-md border border-neutral-300 bg-surface px-3 py-2 text-sm text-text focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-50"
      >
        {pending ? "Đang lưu..." : "Lưu giới hạn"}
      </button>
      {state.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
      <p className="w-full text-xs text-neutral-500">
        Áp dụng cho mỗi lượt tạo mã QR nạp credit — để trống nghĩa là không giới hạn.
      </p>
    </form>
  );
}
