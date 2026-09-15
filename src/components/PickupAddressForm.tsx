"use client";

import { useActionState, useState } from "react";
import { updatePickupAddress, type PickupAddressFormState } from "@/lib/actions/account";
import { AddressPicker } from "@/components/AddressPicker";

const initialState: PickupAddressFormState = {};

const inputClass =
  "rounded-md border border-neutral-300 bg-surface px-3 py-2 text-sm text-text placeholder:text-neutral-500 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500";

// Địa chỉ lấy hàng dùng làm from_* mỗi lần tạo vận đơn GHN cho đơn của chính seller này (xem
// updatePickupAddress ở actions/account.ts) — bắt buộc phải điền trước khi tạo đơn thủ công
// hoặc tạo vận đơn GHN, cả 2 nơi đó tự điều hướng về đây nếu chưa cấu hình.
export function PickupAddressForm({
  defaultPickupName,
  defaultPickupPhone,
  defaultPickupAddress,
  defaultProvinceId,
  defaultProvinceName,
  defaultDistrictId,
  defaultDistrictName,
  defaultWardCode,
  defaultWardName,
}: {
  defaultPickupName?: string;
  defaultPickupPhone?: string;
  defaultPickupAddress?: string;
  defaultProvinceId?: number;
  defaultProvinceName?: string;
  defaultDistrictId?: number;
  defaultDistrictName?: string;
  defaultWardCode?: string;
  defaultWardName?: string;
}) {
  const [state, formAction, pending] = useActionState(updatePickupAddress, initialState);
  // Chỉ cập nhật lúc rời khỏi ô địa chỉ (blur), không phải mỗi phím gõ — đủ để AddressPicker
  // tự nhận diện tỉnh/quận/phường mà không gọi GHN liên tục lúc đang gõ dở.
  const [addressHint, setAddressHint] = useState(defaultPickupAddress ?? "");

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="pickupName" className="text-sm font-medium text-text">
            Tên liên hệ lấy hàng
          </label>
          <input
            id="pickupName"
            name="pickupName"
            defaultValue={defaultPickupName}
            required
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="pickupPhone" className="text-sm font-medium text-text">
            Số điện thoại
          </label>
          <input
            id="pickupPhone"
            name="pickupPhone"
            type="tel"
            inputMode="numeric"
            maxLength={10}
            placeholder="0901234567"
            defaultValue={defaultPickupPhone}
            required
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="pickupAddress" className="text-sm font-medium text-text">
          Địa chỉ (số nhà, tên đường...)
        </label>
        <input
          id="pickupAddress"
          name="pickupAddress"
          defaultValue={defaultPickupAddress}
          required
          onBlur={(e) => setAddressHint(e.target.value)}
          className={inputClass}
        />
      </div>

      <AddressPicker
        initialProvinceId={defaultProvinceId}
        initialProvinceName={defaultProvinceName}
        initialDistrictId={defaultDistrictId}
        initialDistrictName={defaultDistrictName}
        initialWardCode={defaultWardCode}
        initialWardName={defaultWardName}
        addressHint={addressHint}
      />

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-accent-2-700">Đã lưu địa chỉ lấy hàng.</p>}

      <button
        type="submit"
        disabled={pending}
        data-tour="settings-pickup-save"
        className="self-start rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600 disabled:opacity-50"
      >
        {pending ? "Đang lưu..." : "Lưu địa chỉ lấy hàng"}
      </button>
    </form>
  );
}
