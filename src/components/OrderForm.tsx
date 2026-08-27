"use client";

import { useActionState } from "react";
import type { OrderFormState } from "@/lib/actions/orders";
import { AddressPicker } from "@/components/AddressPicker";

const initialState: OrderFormState = {};

const inputClass =
  "rounded-md border border-neutral-300 bg-surface px-3 py-2 text-sm text-text focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500";
const lockedInputClass =
  "rounded-md border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm text-neutral-500 cursor-not-allowed";

// Dùng chung cho cả tạo đơn mới (/admin/orders/new) và sửa đơn đã tạo (/admin/orders/[id])
// — mỗi trường đều có label + textbox riêng (GHN cho sửa hầu hết các trường này qua
// shipping-order/update khi đơn còn ở giai đoạn cho phép, xem updateOrder ở actions/orders.ts).
export function OrderForm({
  action,
  submitLabel = "Tạo đơn hàng",
  pendingLabel = "Đang tạo...",
  savedMessage = "Đã lưu thay đổi.",
  defaultBuyerName,
  defaultBuyerPhone,
  defaultBuyerAddress,
  defaultProvinceId,
  defaultProvinceName,
  defaultDistrictId,
  defaultDistrictName,
  defaultWardCode,
  defaultWardName,
  defaultCodAmount,
  defaultWeightGram = 500,
  defaultLengthCm = 20,
  defaultWidthCm = 20,
  defaultHeightCm = 10,
  defaultNote,
  defaultShopPaysShipping = false,
  recipientLocked = false,
  codLocked = false,
}: {
  action: (prevState: OrderFormState | undefined, formData: FormData) => Promise<OrderFormState>;
  submitLabel?: string;
  pendingLabel?: string;
  savedMessage?: string;
  defaultBuyerName?: string;
  defaultBuyerPhone?: string;
  defaultBuyerAddress?: string;
  defaultProvinceId?: number;
  defaultProvinceName?: string;
  defaultDistrictId?: number;
  defaultDistrictName?: string;
  defaultWardCode?: string;
  defaultWardName?: string;
  defaultCodAmount?: number;
  defaultWeightGram?: number;
  defaultLengthCm?: number;
  defaultWidthCm?: number;
  defaultHeightCm?: number;
  defaultNote?: string;
  defaultShopPaysShipping?: boolean;
  // GHN đã lấy hàng thật (recipientLocked) / đã bắt đầu giao-hoàn-huỷ (codLocked) — tô xám
  // các trường GHN không còn cho sửa nữa, xem getOrderFieldLocks (src/lib/orders.ts).
  recipientLocked?: boolean;
  codLocked?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-4">
      {recipientLocked && (
        <p className="rounded-md bg-neutral-100 px-3 py-2 text-xs text-neutral-600">
          Vận đơn GHN đã lấy hàng — không sửa được thông tin người nhận, địa chỉ và kích
          thước/cân nặng nữa.
        </p>
      )}
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
            readOnly={recipientLocked}
            className={recipientLocked ? lockedInputClass : inputClass}
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
            readOnly={recipientLocked}
            className={recipientLocked ? lockedInputClass : inputClass}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="buyerAddress" className="text-sm font-medium text-text">
          Địa chỉ (số nhà, tên đường...)
        </label>
        <input
          id="buyerAddress"
          name="buyerAddress"
          defaultValue={defaultBuyerAddress}
          required
          readOnly={recipientLocked}
          className={recipientLocked ? lockedInputClass : inputClass}
        />
      </div>

      <AddressPicker
        initialProvinceId={defaultProvinceId}
        initialProvinceName={defaultProvinceName}
        initialDistrictId={defaultDistrictId}
        initialDistrictName={defaultDistrictName}
        initialWardCode={defaultWardCode}
        initialWardName={defaultWardName}
        locked={recipientLocked}
      />

      {codLocked && (
        <p className="rounded-md bg-neutral-100 px-3 py-2 text-xs text-neutral-600">
          Đơn đã bắt đầu giao/hoàn/huỷ — không sửa được tiền thu hộ, bên trả phí ship và
          ghi chú nữa.
        </p>
      )}
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
            readOnly={codLocked}
            className={codLocked ? lockedInputClass : inputClass}
          />
        </div>
        <label
          className={`flex items-center gap-2 pb-2 text-sm sm:pt-6 ${codLocked ? "text-neutral-400" : "text-neutral-700"}`}
        >
          <input
            type="checkbox"
            name={codLocked ? undefined : "shopPaysShipping"}
            defaultChecked={defaultShopPaysShipping}
            disabled={codLocked}
            className="h-4 w-4 rounded border-neutral-300 disabled:cursor-not-allowed"
          />
          Shop tự trả phí ship (mặc định người mua trả khi nhận hàng)
          {codLocked && defaultShopPaysShipping && (
            <input type="hidden" name="shopPaysShipping" value="on" />
          )}
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="weightGram" className="text-sm font-medium text-text">
            Cân nặng (g)
          </label>
          <input
            id="weightGram"
            name="weightGram"
            type="number"
            min={1}
            defaultValue={defaultWeightGram}
            required
            readOnly={recipientLocked}
            className={recipientLocked ? lockedInputClass : inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="lengthCm" className="text-sm font-medium text-text">
            Dài (cm)
          </label>
          <input
            id="lengthCm"
            name="lengthCm"
            type="number"
            min={1}
            defaultValue={defaultLengthCm}
            required
            readOnly={recipientLocked}
            className={recipientLocked ? lockedInputClass : inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="widthCm" className="text-sm font-medium text-text">
            Rộng (cm)
          </label>
          <input
            id="widthCm"
            name="widthCm"
            type="number"
            min={1}
            defaultValue={defaultWidthCm}
            required
            readOnly={recipientLocked}
            className={recipientLocked ? lockedInputClass : inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="heightCm" className="text-sm font-medium text-text">
            Cao (cm)
          </label>
          <input
            id="heightCm"
            name="heightCm"
            type="number"
            min={1}
            defaultValue={defaultHeightCm}
            required
            readOnly={recipientLocked}
            className={recipientLocked ? lockedInputClass : inputClass}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="note" className="text-sm font-medium text-text">
          Ghi chú (không bắt buộc)
        </label>
        <textarea
          id="note"
          name="note"
          rows={2}
          defaultValue={defaultNote}
          readOnly={codLocked}
          className={codLocked ? lockedInputClass : inputClass}
        />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-accent-2-700">{savedMessage}</p>}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600 disabled:opacity-50"
      >
        {pending ? pendingLabel : submitLabel}
      </button>
    </form>
  );
}
