"use client";

import { useActionState } from "react";
import { updateBuyerInfo, type BuyerAccountInfoFormState } from "@/lib/actions/buyer-account";

const initialState: BuyerAccountInfoFormState = {};

const inputClass =
  "rounded-md border border-neutral-300 bg-surface px-3 py-2 text-sm text-text focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500";

export function BuyerAccountInfoForm({ defaultName }: { defaultName: string }) {
  const [state, formAction, pending] = useActionState(updateBuyerInfo, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium text-text">
          Tên
        </label>
        <input id="name" name="name" defaultValue={defaultName} required className={inputClass} />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-accent-2-700">Đã lưu thay đổi.</p>}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600 disabled:opacity-50"
      >
        {pending ? "Đang lưu..." : "Lưu thay đổi"}
      </button>
    </form>
  );
}
