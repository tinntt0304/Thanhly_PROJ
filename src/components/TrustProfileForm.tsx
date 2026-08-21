"use client";

import { useActionState } from "react";
import { updateTrustProfile, type TrustFormState } from "@/lib/actions/trust";

const initialState: TrustFormState = {};

const inputClass =
  "rounded-md border border-neutral-300 bg-surface px-3 py-2 text-sm text-text focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500";

export function TrustProfileForm({
  avgRating,
  soldCount,
  reviewsText,
}: {
  avgRating: number;
  soldCount: number;
  reviewsText: string;
}) {
  const [state, formAction, pending] = useActionState(updateTrustProfile, initialState);

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="avgRating" className="text-sm font-medium text-text">
            Số sao đánh giá trung bình
          </label>
          <input
            id="avgRating"
            name="avgRating"
            type="number"
            step={0.1}
            min={0}
            max={5}
            defaultValue={avgRating}
            required
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="soldCount" className="text-sm font-medium text-text">
            Số đơn đã bán
          </label>
          <input
            id="soldCount"
            name="soldCount"
            type="number"
            min={0}
            defaultValue={soldCount}
            required
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="reviewsText" className="text-sm font-medium text-text">
          Review nổi bật (mỗi dòng: Tên khách | Nội dung review)
        </label>
        <textarea
          id="reviewsText"
          name="reviewsText"
          rows={6}
          defaultValue={reviewsText}
          placeholder={"Chị Lan | Giao hàng nhanh, đóng gói kỹ, sản phẩm đúng mô tả."}
          className={`${inputClass} font-mono text-xs`}
        />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600 disabled:opacity-50"
      >
        {pending ? "Đang lưu..." : "Lưu"}
      </button>
    </form>
  );
}
