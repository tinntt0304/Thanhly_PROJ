"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import Image from "next/image";
import { uploadLibraryImages, removeLibraryImage, removeLibraryImages } from "@/lib/actions/image-library";
import { isOptimizableProductImage } from "@/lib/image-url";

type LibraryImage = { url: string; name: string };

// Upload xong prepend luôn URL trả về vào danh sách hiển thị (không gọi lại server để lấy
// danh sách mới) — nhanh, và server action chỉ trả về đúng những ảnh vừa tải nên đủ dữ liệu.
export function ImageLibraryManager({ initialImages }: { initialImages: LibraryImage[] }) {
  const [images, setImages] = useState<LibraryImage[]>(initialImages);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [removingUrl, setRemovingUrl] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkRemoving, setBulkRemoving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const files = Array.from(fileInputRef.current?.files ?? []);
    if (files.length === 0) return;

    const formData = new FormData();
    files.forEach((f) => formData.append("images", f));
    setPending(true);
    setError(null);
    const res = await uploadLibraryImages(undefined, formData);
    setPending(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setImages((prev) => [...(res.images ?? []), ...prev]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleCopy(url: string) {
    await navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl((c) => (c === url ? null : c)), 2000);
  }

  async function handleRemove(url: string) {
    if (!window.confirm("Xoá ảnh này khỏi thư viện?")) return;
    setRemovingUrl(url);
    setError(null);
    const res = await removeLibraryImage(url);
    setRemovingUrl(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setImages((prev) => prev.filter((img) => img.url !== url));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(url);
      return next;
    });
  }

  function toggleOne(url: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === images.length ? new Set() : new Set(images.map((img) => img.url))));
  }

  async function handleBulkRemove() {
    if (selected.size === 0) return;
    if (!window.confirm(`Xoá ${selected.size} ảnh đã chọn khỏi thư viện?`)) return;
    setBulkRemoving(true);
    setError(null);
    const urls = Array.from(selected);
    const res = await removeLibraryImages(urls);
    setBulkRemoving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setImages((prev) => prev.filter((img) => !selected.has(img.url)));
    setSelected(new Set());
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleUpload} className="flex flex-wrap items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          name="images"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          required
          className="text-sm text-neutral-700 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-accent-500 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-accent-600"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600 disabled:opacity-50"
        >
          {pending ? "Đang tải lên..." : "Tải ảnh lên"}
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-neutral-500">
        JPEG/PNG/WEBP/GIF, tối đa 5MB/ảnh. Bấm &ldquo;Sao chép link&rdquo; rồi dán vào cột
        &ldquo;Ảnh&rdquo; trong file Excel import (nhiều ảnh/sản phẩm thì cách nhau bởi dấu phẩy).
      </p>

      {images.length === 0 ? (
        <p className="text-sm text-neutral-600">Chưa có ảnh nào trong thư viện.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={images.length > 0 && selected.size === images.length}
                onChange={toggleAll}
                className="h-4 w-4 rounded border-neutral-300"
                aria-label="Chọn tất cả"
              />
              Chọn tất cả
            </label>
            {selected.size > 0 && (
              <>
                <span className="text-sm font-medium text-text">Đã chọn {selected.size} ảnh</span>
                <button
                  type="button"
                  onClick={handleBulkRemove}
                  disabled={bulkRemoving}
                  className="rounded-md border border-red-200 bg-red-50/50 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
                >
                  {bulkRemoving ? "Đang xoá..." : `Xoá ${selected.size} ảnh đã chọn`}
                </button>
                <button type="button" onClick={() => setSelected(new Set())} className="text-xs text-neutral-500 underline">
                  Bỏ chọn
                </button>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {images.map((img) => (
              <div key={img.url} className="flex flex-col gap-1.5">
                <div className="relative aspect-square overflow-hidden rounded-md bg-neutral-100">
                  <Image
                    src={img.url}
                    alt=""
                    fill
                    sizes="200px"
                    className="object-cover"
                    unoptimized={!isOptimizableProductImage(img.url)}
                  />
                  <label className="absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded bg-white/90 shadow">
                    <input
                      type="checkbox"
                      checked={selected.has(img.url)}
                      onChange={() => toggleOne(img.url)}
                      className="h-4 w-4 rounded border-neutral-300"
                      aria-label={`Chọn ảnh ${img.name}`}
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(img.url)}
                  className="rounded-md border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
                >
                  {copiedUrl === img.url ? "Đã sao chép!" : "Sao chép link"}
                </button>
                <button
                  type="button"
                  onClick={() => handleRemove(img.url)}
                  disabled={removingUrl === img.url}
                  className="rounded-md border border-red-200 bg-red-50/50 px-2 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
                >
                  {removingUrl === img.url ? "Đang xoá..." : "Xoá ảnh"}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
