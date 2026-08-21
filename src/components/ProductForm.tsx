"use client";

import { useActionState } from "react";
import type { ProductFormState } from "@/lib/actions/products";
import type { Product } from "@/generated/prisma/client";

const initialState: ProductFormState = {};

function toDateTimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export function ProductForm({
  action,
  product,
  submitLabel,
}: {
  action: (prevState: ProductFormState | undefined, formData: FormData) => Promise<ProductFormState>;
  product?: Product;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="title" className="text-sm font-medium">
          Tên sản phẩm
        </label>
        <input
          id="title"
          name="title"
          defaultValue={product?.title}
          required
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="description" className="text-sm font-medium">
          Mô tả
        </label>
        <textarea
          id="description"
          name="description"
          defaultValue={product?.description}
          required
          rows={4}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="condition" className="text-sm font-medium">
          Tình trạng
        </label>
        <input
          id="condition"
          name="condition"
          defaultValue={product?.condition}
          required
          placeholder="Mới / Đã dùng - còn tốt / Lỗi nhẹ: ..."
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="images" className="text-sm font-medium">
          Link ảnh (mỗi dòng 1 link, ảnh đầu tiên là ảnh đại diện)
        </label>
        <textarea
          id="images"
          name="images"
          defaultValue={product?.images.join("\n")}
          required
          rows={3}
          placeholder="https://..."
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-mono text-xs"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="startPrice" className="text-sm font-medium">
            Giá khởi điểm (đ)
          </label>
          <input
            id="startPrice"
            name="startPrice"
            type="number"
            min={1}
            defaultValue={product?.startPrice}
            required
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="minBidStep" className="text-sm font-medium">
            Bước giá tối thiểu (đ)
          </label>
          <input
            id="minBidStep"
            name="minBidStep"
            type="number"
            min={1}
            defaultValue={product?.minBidStep}
            required
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="buyNowPrice" className="text-sm font-medium">
          Giá mua ngay (đ) — để trống nếu không dùng
        </label>
        <input
          id="buyNowPrice"
          name="buyNowPrice"
          type="number"
          min={1}
          defaultValue={product?.buyNowPrice ?? undefined}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="endTime" className="text-sm font-medium">
          Thời gian kết thúc
        </label>
        <input
          id="endTime"
          name="endTime"
          type="datetime-local"
          defaultValue={product ? toDateTimeLocal(product.endTime) : undefined}
          required
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Đang lưu..." : submitLabel}
      </button>
    </form>
  );
}
