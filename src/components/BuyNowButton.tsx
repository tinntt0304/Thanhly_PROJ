"use client";

import { useActionState, useState, type FormEvent } from "react";
import { buyNowAction, type BuyNowState } from "@/lib/actions/buy-now";
import { getPublicGhnProvinces, getPublicGhnDistricts, getPublicGhnWards } from "@/lib/actions/orders";
import type { Attribute } from "@/lib/attributes";
import { AddressPicker } from "@/components/AddressPicker";
import { formatVND } from "@/lib/auction";

const initialState: BuyNowState = {};

const inputClass =
  "rounded-md border border-neutral-300 bg-surface px-3 py-2 text-sm text-text placeholder:text-neutral-500 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500";

// Nút "Mua ngay" ở trang sản phẩm công khai — mở modal chứa form nhận hàng (tên/SĐT/địa
// chỉ + GHN tỉnh/quận/phường) và chọn thuộc tính nếu sản phẩm có khai báo (xem
// Product.attributes, asAttributes ở lib/attributes.ts). Bấm "Tạo đơn" gọi thẳng
// buyNowAction (public, không cần đăng nhập) — đơn tạo ra hiện ngay trong "Quản lý đơn
// hàng" của người bán ở admin, không cần thao tác gì thêm.
export function BuyNowButton({
  productId,
  buyNowPrice,
  attributes,
  canBuy,
}: {
  productId: string;
  buyNowPrice: number;
  attributes: Attribute[];
  // false khi phiên đấu giá không còn ở trạng thái BIDDING (đã hết giờ/đã bán/đã huỷ).
  // Component vẫn PHẢI render (không bọc điều kiện này ở page.tsx) — tạo đơn xong,
  // buyNowAction đánh dấu product SOLD rồi revalidatePath, Server Component cha render lại
  // với canBuy=false NGAY LẬP TỨC; nếu unmount theo canBuy thì modal xác nhận "Đã tạo đơn
  // hàng thành công" biến mất trước khi người mua kịp thấy.
  canBuy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(buyNowAction.bind(null, productId), initialState);
  const [clientError, setClientError] = useState<string | null>(null);
  const [selectedValues, setSelectedValues] = useState<Record<string, string>>({});

  if (!canBuy && !state.success) return null;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    const missing = attributes.find((attr) => !selectedValues[attr.name]);
    if (missing) {
      e.preventDefault();
      setClientError(`Vui lòng chọn "${missing.name}".`);
      return;
    }
    setClientError(null);
  }

  const selectedAttributesJson = JSON.stringify(
    attributes.map((attr) => ({ name: attr.name, value: selectedValues[attr.name] ?? "" }))
  );

  const displayedError = clientError ?? state.error;

  return (
    <>
      {!state.success && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md bg-accent-2-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-2-700"
        >
          Mua ngay — {formatVND(buyNowPrice)}
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-surface p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-heading text-lg font-bold text-text">Mua ngay</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Đóng"
                className="rounded-full px-2 py-1 text-neutral-500 hover:bg-neutral-100 hover:text-text"
              >
                ✕
              </button>
            </div>

            {state.success ? (
              <div className="rounded-lg border border-accent-2-300 bg-accent-2-100 p-4 text-sm text-accent-2-700">
                Đã tạo đơn hàng thành công! Người bán sẽ sớm liên hệ với bạn qua số điện thoại
                vừa nhập để xác nhận và giao hàng.
              </div>
            ) : (
              <form action={formAction} onSubmit={handleSubmit} className="flex flex-col gap-3">
                <p className="text-sm text-neutral-700">
                  Giá mua ngay: <span className="font-semibold text-text">{formatVND(buyNowPrice)}</span>
                </p>

                {attributes.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {attributes.map((attr) => (
                      <div key={attr.name} className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-text">{attr.name}</label>
                        <div className="flex flex-wrap gap-1.5">
                          {attr.values.map((val) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setSelectedValues((prev) => ({ ...prev, [attr.name]: val }))}
                              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                                selectedValues[attr.name] === val
                                  ? "border-accent-500 bg-accent-100 text-accent-700"
                                  : "border-neutral-300 text-neutral-700 hover:bg-neutral-100"
                              }`}
                            >
                              {val}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <input type="hidden" name="selectedAttributesJson" value={selectedAttributesJson} />

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="buyNow-buyerName" className="text-sm font-medium text-text">
                      Họ tên người nhận
                    </label>
                    <input id="buyNow-buyerName" name="buyerName" required className={inputClass} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="buyNow-buyerPhone" className="text-sm font-medium text-text">
                      Số điện thoại
                    </label>
                    <input
                      id="buyNow-buyerPhone"
                      name="buyerPhone"
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="0901234567"
                      required
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="buyNow-buyerAddress" className="text-sm font-medium text-text">
                    Địa chỉ (số nhà, tên đường...)
                  </label>
                  <input id="buyNow-buyerAddress" name="buyerAddress" required className={inputClass} />
                </div>

                <AddressPicker
                  fetchProvinces={getPublicGhnProvinces}
                  fetchDistricts={getPublicGhnDistricts}
                  fetchWards={getPublicGhnWards}
                />

                <div className="flex flex-col gap-1">
                  <label htmlFor="buyNow-note" className="text-sm font-medium text-text">
                    Ghi chú (không bắt buộc)
                  </label>
                  <textarea id="buyNow-note" name="note" rows={2} className={inputClass} />
                </div>

                {displayedError && <p className="text-sm text-red-600">{displayedError}</p>}

                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-md bg-accent-2-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-2-700 disabled:opacity-50"
                >
                  {pending ? "Đang tạo đơn..." : "Tạo đơn"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
