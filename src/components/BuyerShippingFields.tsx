"use client";

import { getPublicGhnProvinces, getPublicGhnDistricts, getPublicGhnWards } from "@/lib/actions/orders";
import { AddressPicker } from "@/components/AddressPicker";

const inputClass =
  "rounded-md border border-neutral-300 bg-surface px-3 py-2 text-sm text-text placeholder:text-neutral-500 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500";

// Khối field nhận hàng dùng chung giữa BuyNowButton (mua ngay 1 sản phẩm) và CartCheckoutForm
// (đặt hàng cả giỏ) — tên/SĐT/địa chỉ + AddressPicker bản public (không cần đăng nhập seller)
// + ghi chú. Tách riêng vì đây là UI thuần (không phải file "use server") nên tái dùng an toàn.
export function BuyerShippingFields({
  idPrefix,
  defaultName,
  defaultPhone,
}: {
  idPrefix: string;
  defaultName?: string;
  defaultPhone?: string;
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${idPrefix}-buyerName`} className="text-sm font-medium text-text">
            Họ tên người nhận
          </label>
          <input
            id={`${idPrefix}-buyerName`}
            name="buyerName"
            defaultValue={defaultName}
            required
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${idPrefix}-buyerPhone`} className="text-sm font-medium text-text">
            Số điện thoại
          </label>
          <input
            id={`${idPrefix}-buyerPhone`}
            name="buyerPhone"
            type="tel"
            inputMode="numeric"
            maxLength={10}
            placeholder="0901234567"
            defaultValue={defaultPhone}
            required
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${idPrefix}-buyerAddress`} className="text-sm font-medium text-text">
          Địa chỉ (số nhà, tên đường...)
        </label>
        <input id={`${idPrefix}-buyerAddress`} name="buyerAddress" required className={inputClass} />
      </div>

      <AddressPicker
        fetchProvinces={getPublicGhnProvinces}
        fetchDistricts={getPublicGhnDistricts}
        fetchWards={getPublicGhnWards}
      />

      <div className="flex flex-col gap-1">
        <label htmlFor={`${idPrefix}-note`} className="text-sm font-medium text-text">
          Ghi chú (không bắt buộc)
        </label>
        <textarea id={`${idPrefix}-note`} name="note" rows={2} className={inputClass} />
      </div>
    </>
  );
}
