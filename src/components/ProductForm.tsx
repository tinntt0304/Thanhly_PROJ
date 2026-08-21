"use client";

import { useActionState, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import type { ProductFormState } from "@/lib/actions/products";
import type { Product } from "@/generated/prisma/client";
import type { Attribute } from "@/lib/attributes";
import { asAttributes } from "@/lib/attributes";
import { MAX_IMAGES_PER_PRODUCT } from "@/lib/product-limits";

const initialState: ProductFormState = {};

function toDateTimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function syncFileInput(input: HTMLInputElement | null, files: File[]) {
  if (!input) return;
  const dt = new DataTransfer();
  files.forEach((f) => dt.items.add(f));
  input.files = dt.files;
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

  const [keptImages, setKeptImages] = useState<string[]>(product?.images ?? []);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const totalImages = keptImages.length + pendingFiles.length;

  const [attributes, setAttributes] = useState<Attribute[]>(asAttributes(product?.attributes));

  function handleFilesSelected(e: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    const next = [...pendingFiles, ...selected].slice(0, MAX_IMAGES_PER_PRODUCT - keptImages.length);
    setPendingFiles(next);
    syncFileInput(fileInputRef.current, next);
  }

  function removePendingFile(index: number) {
    const next = pendingFiles.filter((_, i) => i !== index);
    setPendingFiles(next);
    syncFileInput(fileInputRef.current, next);
  }

  function removeKeptImage(url: string) {
    setKeptImages((prev) => prev.filter((u) => u !== url));
  }

  function addAttribute() {
    setAttributes((prev) => [...prev, { name: "", value: "" }]);
  }

  function updateAttribute(index: number, field: "name" | "value", value: string) {
    setAttributes((prev) => prev.map((a, i) => (i === index ? { ...a, [field]: value } : a)));
  }

  function removeAttribute(index: number) {
    setAttributes((prev) => prev.filter((_, i) => i !== index));
  }

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

      {/* Ảnh sản phẩm */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">
          Ảnh sản phẩm ({totalImages}/{MAX_IMAGES_PER_PRODUCT}, ảnh đầu tiên là ảnh đại diện)
        </label>

        {(keptImages.length > 0 || pendingFiles.length > 0) && (
          <div className="flex flex-wrap gap-2">
            {keptImages.map((url) => (
              <div key={url} className="relative h-20 w-20 overflow-hidden rounded-md border border-neutral-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeKeptImage(url)}
                  className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white"
                  aria-label="Xoá ảnh"
                >
                  ×
                </button>
                <input type="hidden" name="keptImages" value={url} />
              </div>
            ))}
            {pendingFiles.map((file, i) => (
              <div key={i} className="relative h-20 w-20 overflow-hidden rounded-md border border-neutral-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={URL.createObjectURL(file)} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePendingFile(i)}
                  className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white"
                  aria-label="Xoá ảnh"
                >
                  ×
                </button>
                <span className="absolute bottom-0.5 left-0.5 rounded bg-black/60 px-1 text-[10px] text-white">
                  mới
                </span>
              </div>
            ))}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          name="imageFiles"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          onChange={handleFilesSelected}
          disabled={totalImages >= MAX_IMAGES_PER_PRODUCT}
          className="text-sm"
        />
        <p className="text-xs text-neutral-500">JPEG/PNG/WEBP/GIF, tối đa 5MB mỗi ảnh.</p>
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

      {/* Thuộc tính sản phẩm */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">
          Thuộc tính sản phẩm (thương hiệu, dung tích, xuất xứ...)
        </label>
        <div className="flex flex-col gap-2">
          {attributes.map((attr, i) => (
            <div key={i} className="flex gap-2">
              <input
                name="attrName"
                value={attr.name}
                onChange={(e) => updateAttribute(i, "name", e.target.value)}
                placeholder="Tên thuộc tính (vd. Thương hiệu)"
                className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
              <input
                name="attrValue"
                value={attr.value}
                onChange={(e) => updateAttribute(i, "value", e.target.value)}
                placeholder="Giá trị (vd. Philips)"
                className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => removeAttribute(i)}
                className="shrink-0 rounded-md border border-neutral-300 px-2 text-sm text-neutral-500 hover:bg-neutral-50"
                aria-label="Xoá thuộc tính"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addAttribute}
          className="self-start rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
        >
          + Thêm thuộc tính
        </button>
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
