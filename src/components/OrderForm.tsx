"use client";

import { useActionState } from "react";
import type { OrderFormState } from "@/lib/actions/orders";
import { AddressPicker } from "@/components/AddressPicker";

const initialState: OrderFormState = {};

const inputClass =
  "rounded-md border border-neutral-300 bg-surface px-3 py-2 text-sm text-text focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500";

export function OrderForm({
  action,
  defaultBuyerName,
  defaultBuyerPhone,
  defaultCodAmount,
}: {
  action: (prevState: OrderFormState | undefined, formData: FormData) => Promise<OrderFormState>;
  defaultBuyerName?: string;
  defaultBuyerPhone?: string;
  defaultCodAmount?: number;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="buyerName" className="text-sm font-medium text-text">
            Tên người nhận
          </label>
          <input
            id="buyerName"
            name="buyerName"
            defaultValue={defaultBuyerName}
            required
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="buyerPhone" className="text-sm font-medium text-text">
            SĐT người nhận
          </label>
          <input
            id="buyerPhone"
            name="buyerPhone"
            defaultValue={defaultBuyerPhone}
            required
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="buyerAddress" className="text-sm font-medium text-text">
          Địa chỉ (số nhà, tên đường...)
        </label>
        <input id="buyerAddress" name="buyerAddress" required className={inputClass} />
      </div>

      <AddressPicker />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="codAmount" className="text-sm font-medium text-text">
            Tiền thu hộ (COD, VNĐ)
          </label>
          <input
            id="codAmount"
            name="codAmount"
            type="number"
            min={0}
            defaultValue={defaultCodAmount ?? 0}
            required
            className={inputClass}
          />
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm text-neutral-700 sm:pt-6">
          <input type="checkbox" name="shopPaysShipping" className="h-4 w-4 rounded border-neutral-300" />
          Shop tự trả phí ship (mặc định người mua trả khi nhận hàng)
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="weightGram" className="text-sm font-medium text-text">
            Cân nặng (g)
          </label>
          <input id="weightGram" name="weightGram" type="number" min={1} defaultValue={500} required className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="lengthCm" className="text-sm font-medium text-text">
            Dài (cm)
          </label>
          <input id="lengthCm" name="lengthCm" type="number" min={1} defaultValue={20} required className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="widthCm" className="text-sm font-medium text-text">
            Rộng (cm)
          </label>
          <input id="widthCm" name="widthCm" type="number" min={1} defaultValue={20} required className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="heightCm" className="text-sm font-medium text-text">
            Cao (cm)
          </label>
          <input id="heightCm" name="heightCm" type="number" min={1} defaultValue={10} required className={inputClass} />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="note" className="text-sm font-medium text-text">
          Ghi chú (không bắt buộc)
        </label>
        <textarea id="note" name="note" rows={2} className={inputClass} />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600 disabled:opacity-50"
      >
        {pending ? "Đang tạo..." : "Tạo đơn hàng"}
      </button>
    </form>
  );
}
