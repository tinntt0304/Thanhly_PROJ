"use client";

import { useActionState, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import type { ProductFormState } from "@/lib/actions/products";
import type { Product } from "@/generated/prisma/client";
import type { Attribute } from "@/lib/attributes";
import { asAttributes } from "@/lib/attributes";
import { MAX_IMAGES_PER_PRODUCT } from "@/lib/product-limits";
import { TAG_LABEL, TAG_VALUES, asProductTags, type ProductTag } from "@/lib/tags";
import { toDateTimeLocal } from "@/lib/datetime";
import { compressImageForUpload } from "@/lib/client-image-compress";
import { PRODUCT_CONDITIONS } from "@/lib/product-condition";

const initialState: ProductFormState = {};

const inputClass =
  "rounded-md border border-neutral-300 bg-surface px-3 py-2 text-sm text-text placeholder:text-neutral-500 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500";

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
  // Text đang gõ dở cho ô nhập giá trị của từng thuộc tính (chưa "chốt" thành tag) —
  // song song theo index với `attributes`.
  const [valueDrafts, setValueDrafts] = useState<string[]>(attributes.map(() => ""));
  const [tags, setTags] = useState<ProductTag[]>(asProductTags(product?.tags ?? []));

  function toggleTag(tag: ProductTag) {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  // Nén ngay trong trình duyệt trước khi đưa vào input thật — phần chậm khi đăng sản phẩm có
  // nhiều ảnh chủ yếu là thời gian TRUYỀN file gốc (vài MB/ảnh) qua đường tải lên của người
  // dùng khi bấm lưu, không phải xử lý phía server (server vẫn nén lại 1 lần nữa, xem
  // lib/storage.ts). Xem lib/client-image-compress.ts.
  async function handleFilesSelected(e: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    const compressed = await Promise.all(selected.map(compressImageForUpload));
    const next = [...pendingFiles, ...compressed].slice(0, MAX_IMAGES_PER_PRODUCT - keptImages.length);
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
    setAttributes((prev) => [...prev, { name: "", values: [] }]);
    setValueDrafts((prev) => [...prev, ""]);
  }

  function updateAttributeName(index: number, name: string) {
    setAttributes((prev) => prev.map((a, i) => (i === index ? { ...a, name } : a)));
  }

  function removeAttribute(index: number) {
    setAttributes((prev) => prev.filter((_, i) => i !== index));
    setValueDrafts((prev) => prev.filter((_, i) => i !== index));
  }

  // Chốt text đang gõ thành 1 hoặc nhiều tag giá trị — hỗ trợ dán/gõ nhiều giá trị
  // cùng lúc cách nhau bằng dấu phẩy (vd. "Đỏ, Xanh, Vàng" -> 3 tag).
  function commitValueDraft(index: number, raw: string) {
    const newValues = raw
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    if (newValues.length === 0) return;

    setAttributes((prev) =>
      prev.map((a, i) =>
        i === index ? { ...a, values: [...new Set([...a.values, ...newValues])] } : a
      )
    );
    setValueDrafts((prev) => prev.map((d, i) => (i === index ? "" : d)));
  }

  function removeAttributeValue(index: number, valueIndex: number) {
    setAttributes((prev) =>
      prev.map((a, i) =>
        i === index ? { ...a, values: a.values.filter((_, vi) => vi !== valueIndex) } : a
      )
    );
  }

  function handleValueDraftKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commitValueDraft(index, valueDrafts[index] ?? "");
    } else if (e.key === "Backspace" && !valueDrafts[index] && attributes[index].values.length > 0) {
      removeAttributeValue(index, attributes[index].values.length - 1);
    }
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="title" className="text-sm font-medium text-text">
          Tên sản phẩm
        </label>
        <input
          id="title"
          name="title"
          defaultValue={product?.title}
          required
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="description" className="text-sm font-medium text-text">
          Mô tả
        </label>
        <textarea
          id="description"
          name="description"
          defaultValue={product?.description}
          required
          rows={4}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="condition" className="text-sm font-medium text-text">
          Tình trạng
        </label>
        <select
          id="condition"
          name="condition"
          defaultValue={product?.condition ?? PRODUCT_CONDITIONS[0]}
          required
          className={inputClass}
        >
          {PRODUCT_CONDITIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="quantity" className="text-sm font-medium text-text">
          Số lượng muốn bán
        </label>
        <input
          id="quantity"
          name="quantity"
          type="number"
          min={1}
          step={1}
          defaultValue={product?.quantity ?? 1}
          required
          className={inputClass}
        />
      </div>

      {/* Nhãn sản phẩm */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-text">Nhãn hiển thị</label>
        <div className="flex flex-wrap gap-3">
          {TAG_VALUES.map((tag) => (
            <label key={tag} className="flex items-center gap-2 text-sm text-text">
              <input
                type="checkbox"
                checked={tags.includes(tag)}
                onChange={() => toggleTag(tag)}
                className="h-4 w-4 rounded border-neutral-300 text-accent-500 focus:ring-accent-500"
              />
              {TAG_LABEL[tag]}
              {tags.includes(tag) && <input type="hidden" name="tags" value={tag} />}
            </label>
          ))}
        </div>
      </div>

      {/* Ảnh sản phẩm */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-text">
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
          <label htmlFor="startPrice" className="text-sm font-medium text-text">
            Giá khởi điểm (đ)
          </label>
          <input
            id="startPrice"
            name="startPrice"
            type="number"
            min={1}
            defaultValue={product?.startPrice}
            required
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="minBidStep" className="text-sm font-medium text-text">
            Bước giá tối thiểu (đ)
          </label>
          <input
            id="minBidStep"
            name="minBidStep"
            type="number"
            min={1}
            defaultValue={product?.minBidStep}
            required
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="buyNowPrice" className="text-sm font-medium text-text">
          Giá mua ngay (đ) — để trống nếu không dùng
        </label>
        <input
          id="buyNowPrice"
          name="buyNowPrice"
          type="number"
          min={1}
          defaultValue={product?.buyNowPrice ?? undefined}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="endTime" className="text-sm font-medium text-text">
          Thời gian kết thúc
        </label>
        <input
          id="endTime"
          name="endTime"
          type="datetime-local"
          defaultValue={product ? toDateTimeLocal(product.endTime) : undefined}
          required
          className={inputClass}
        />
      </div>

      {/* Thuộc tính sản phẩm */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-text">
          Thuộc tính sản phẩm (thương hiệu, màu sắc, dung tích...)
        </label>
        <p className="text-xs text-neutral-500">
          Nếu 1 thuộc tính có nhiều giá trị (vd. Màu sắc: Đỏ, Xanh, Vàng), gõ từng giá trị
          rồi nhấn Enter hoặc dấu phẩy — mỗi giá trị sẽ hiện thành 1 tag riêng.
        </p>
        <div className="flex flex-col gap-3">
          {attributes.map((attr, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-md border border-neutral-200 p-3">
              <div className="flex gap-2">
                <input
                  value={attr.name}
                  onChange={(e) => updateAttributeName(i, e.target.value)}
                  placeholder="Tên thuộc tính (vd. Màu sắc)"
                  className={`flex-1 ${inputClass}`}
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

              <div
                className={`flex flex-wrap items-center gap-1.5 ${inputClass}`}
                onClick={(e) => {
                  if (e.target === e.currentTarget) {
                    (e.currentTarget.querySelector("input") as HTMLInputElement | null)?.focus();
                  }
                }}
              >
                {attr.values.map((val, vi) => (
                  <span
                    key={val + vi}
                    className="inline-flex items-center gap-1 rounded-full bg-accent-2-100 px-2 py-0.5 text-xs font-medium text-accent-2-700"
                  >
                    {val}
                    <button
                      type="button"
                      onClick={() => removeAttributeValue(i, vi)}
                      aria-label={`Xoá giá trị ${val}`}
                      className="text-accent-2-700/70 hover:text-accent-2-700"
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  value={valueDrafts[i] ?? ""}
                  onChange={(e) =>
                    setValueDrafts((prev) => prev.map((d, di) => (di === i ? e.target.value : d)))
                  }
                  onKeyDown={(e) => handleValueDraftKeyDown(i, e)}
                  onBlur={() => commitValueDraft(i, valueDrafts[i] ?? "")}
                  placeholder={attr.values.length === 0 ? "Giá trị (vd. Đỏ), Enter để thêm" : ""}
                  className="min-w-[120px] flex-1 border-none bg-transparent p-0 text-sm outline-none placeholder:text-neutral-500"
                />
              </div>
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
        {/* Gộp cả giá trị đang gõ dở (chưa nhấn Enter/phẩy) vào lúc submit, để không mất
            dữ liệu nếu người dùng bấm nút Lưu ngay sau khi gõ mà quên nhấn Enter. */}
        <input
          type="hidden"
          name="attributesJson"
          value={JSON.stringify(
            attributes
              .map((a, i) => {
                const draftValues = (valueDrafts[i] ?? "")
                  .split(",")
                  .map((v) => v.trim())
                  .filter(Boolean);
                return {
                  name: a.name.trim(),
                  values: [...new Set([...a.values, ...draftValues])],
                };
              })
              .filter((a) => a.name.length > 0 && a.values.length > 0)
          )}
        />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600 disabled:opacity-50"
      >
        {pending ? "Đang lưu..." : submitLabel}
      </button>
    </form>
  );
}
