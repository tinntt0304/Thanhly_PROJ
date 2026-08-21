"use client";

import { useActionState } from "react";
import { updateTrustProfile, type TrustFormState } from "@/lib/actions/trust";

const initialState: TrustFormState = {};

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
    <form action={formAction} className="flex flex-col gap-4 max-w-lg">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="avgRating" className="text-sm font-medium">
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
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="soldCount" className="text-sm font-medium">
            Số đơn đã bán
          </label>
          <input
            id="soldCount"
            name="soldCount"
            type="number"
            min={0}
            defaultValue={soldCount}
            required
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="reviewsText" className="text-sm font-medium">
          Review nổi bật (mỗi dòng: Tên khách | Nội dung review)
        </label>
        <textarea
          id="reviewsText"
          name="reviewsText"
          rows={6}
          defaultValue={reviewsText}
          placeholder={"Chị Lan | Giao hàng nhanh, đóng gói kỹ, sản phẩm đúng mô tả."}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-mono text-xs"
        />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Đang lưu..." : "Lưu"}
      </button>
    </form>
  );
}
