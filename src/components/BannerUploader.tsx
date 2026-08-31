"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import Image from "next/image";
import { addBannerImages, removeBannerImage, updateBannerInterval } from "@/lib/actions/site-content";
import { isOptimizableProductImage } from "@/lib/image-url";
import { MAX_BANNER_IMAGES } from "@/lib/product-limits";
import { compressImageForUpload } from "@/lib/client-image-compress";

const inputClass =
  "rounded-md border border-neutral-300 bg-surface px-3 py-2 text-sm text-text focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500";

// Banner trang chủ dạng slideshow (nhiều ảnh, tự chuyển — xem BannerSlideshow ở
// components/HeroBanner.tsx) + thời gian chuyển slide, quản lý ở /admin/danh-muc. Gọi action
// trực tiếp trong handler (không qua useActionState) để tự quản 1 state ảnh + 1 state thời
// gian, cập nhật ngay không cần đợi revalidatePath.
export function BannerUploader({
  currentImages,
  currentIntervalSeconds,
}: {
  currentImages: string[];
  currentIntervalSeconds: number;
}) {
  const [images, setImages] = useState<string[]>(currentImages);
  const [uploadPending, setUploadPending] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [removingUrl, setRemovingUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [intervalPending, setIntervalPending] = useState(false);
  const [intervalError, setIntervalError] = useState<string | null>(null);
  const [intervalSaved, setIntervalSaved] = useState(false);

  async function handleUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const files = Array.from(fileInputRef.current?.files ?? []);
    if (files.length === 0) return;
    if (images.length + files.length > MAX_BANNER_IMAGES) {
      setUploadError(`Tối đa ${MAX_BANNER_IMAGES} ảnh banner.`);
      return;
    }

    // Nén ngay trong trình duyệt trước khi gửi — phần chậm thật sự nằm ở việc truyền file gốc
    // (vài MB) qua đường tải lên của người dùng, không phải xử lý phía server (xem
    // lib/client-image-compress.ts).
    const compressedFiles = await Promise.all(files.map(compressImageForUpload));
    const formData = new FormData();
    compressedFiles.forEach((f) => formData.append("banners", f));
    setUploadPending(true);
    setUploadError(null);
    const res = await addBannerImages(undefined, formData);
    setUploadPending(false);
    if (res.error) {
      setUploadError(res.error);
      return;
    }
    setImages(res.images ?? images);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleRemove(url: string) {
    if (!window.confirm("Xoá ảnh banner này?")) return;
    setRemovingUrl(url);
    setUploadError(null);
    const res = await removeBannerImage(url);
    setRemovingUrl(null);
    if (res.error) {
      setUploadError(res.error);
      return;
    }
    setImages(res.images ?? images.filter((u) => u !== url));
  }

  async function handleIntervalSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setIntervalPending(true);
    setIntervalError(null);
    setIntervalSaved(false);
    const res = await updateBannerInterval(undefined, formData);
    setIntervalPending(false);
    if (res.error) {
      setIntervalError(res.error);
      return;
    }
    setIntervalSaved(true);
  }

  return (
    <div className="flex flex-col gap-4">
      {images.length === 0 ? (
        <p className="text-sm text-neutral-600">
          Chưa có ảnh banner nào — trang chủ đang dùng nền gradient mặc định.
        </p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {images.map((url) => (
            <div key={url} className="relative h-24 w-40 overflow-hidden rounded-md bg-neutral-100">
              <Image
                src={url}
                alt=""
                fill
                sizes="160px"
                className="object-cover"
                unoptimized={!isOptimizableProductImage(url)}
              />
              <button
                type="button"
                onClick={() => handleRemove(url)}
                disabled={removingUrl === url}
                aria-label="Xoá ảnh banner này"
                className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 py-0.5 text-xs font-medium text-white hover:bg-black/80 disabled:opacity-50"
              >
                {removingUrl === url ? "..." : "✕"}
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleUpload} className="flex flex-wrap items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          name="banners"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          required
          className="text-sm text-neutral-700 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-accent-500 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-accent-600"
        />
        <button
          type="submit"
          disabled={uploadPending || images.length >= MAX_BANNER_IMAGES}
          className="rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600 disabled:opacity-50"
        >
          {uploadPending ? "Đang tải lên..." : "Tải thêm ảnh"}
        </button>
      </form>
      {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
      <p className="text-xs text-neutral-500">
        JPEG/PNG/WEBP/GIF, tối đa 5MB/ảnh, tối đa {MAX_BANNER_IMAGES} ảnh. Ảnh nên nằm ngang
        (vd. 1600×500) để không bị crop xấu. Từ 2 ảnh trở lên sẽ tự động chuyển slide.
      </p>

      <form onSubmit={handleIntervalSubmit} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="intervalSeconds" className="text-sm font-medium text-text">
            Thời gian chuyển slide (giây)
          </label>
          <input
            id="intervalSeconds"
            name="intervalSeconds"
            type="number"
            min={1}
            max={60}
            defaultValue={currentIntervalSeconds}
            required
            className={`${inputClass} w-28`}
          />
        </div>
        <button
          type="submit"
          disabled={intervalPending}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 disabled:opacity-50"
        >
          {intervalPending ? "Đang lưu..." : "Lưu thời gian"}
        </button>
        {intervalSaved && <span className="text-sm text-accent-2-700">Đã lưu.</span>}
      </form>
      {intervalError && <p className="text-sm text-red-600">{intervalError}</p>}
    </div>
  );
}
