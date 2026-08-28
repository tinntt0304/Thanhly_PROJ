"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import Image from "next/image";
import { updateBanner, removeBanner } from "@/lib/actions/site-content";
import { isOptimizableProductImage } from "@/lib/image-url";

// Ảnh banner nền HeroBanner (trang chủ) — lưu qua Supabase Storage + SiteContent (xem
// updateBanner/removeBanner ở actions/site-content.ts). Gọi action trực tiếp trong handler
// (không qua useActionState) để cả upload lẫn xoá cùng cập nhật 1 state hiển thị duy nhất
// ngay lập tức, không cần đợi revalidatePath.
export function BannerUploader({ currentUrl }: { currentUrl: string | null }) {
  const [displayUrl, setDisplayUrl] = useState<string | null>(currentUrl);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.set("banner", file);
    setPending(true);
    setError(null);
    const res = await updateBanner(undefined, formData);
    setPending(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setDisplayUrl(res.url ?? null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleRemove() {
    if (!window.confirm("Xoá banner hiện tại? Trang chủ sẽ quay lại nền gradient mặc định.")) return;
    setPending(true);
    setError(null);
    const res = await removeBanner();
    setPending(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setDisplayUrl(null);
  }

  return (
    <div className="flex flex-col gap-3">
      {displayUrl ? (
        <div className="flex flex-col gap-2">
          <div className="relative h-32 w-full max-w-lg overflow-hidden rounded-md bg-neutral-100">
            <Image
              src={displayUrl}
              alt="Banner trang chủ"
              fill
              sizes="512px"
              className="object-cover"
              unoptimized={!isOptimizableProductImage(displayUrl)}
            />
          </div>
          <button
            type="button"
            onClick={handleRemove}
            disabled={pending}
            className="self-start rounded-md border border-red-200 bg-red-50/50 px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            {pending ? "Đang xử lý..." : "Xoá banner"}
          </button>
        </div>
      ) : (
        <p className="text-sm text-neutral-600">Chưa có banner — trang chủ đang dùng nền gradient mặc định.</p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          name="banner"
          accept="image/jpeg,image/png,image/webp,image/gif"
          required
          className="text-sm text-neutral-700 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-accent-500 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-accent-600"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600 disabled:opacity-50"
        >
          {pending ? "Đang tải lên..." : "Tải ảnh banner lên"}
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-neutral-500">
        JPEG/PNG/WEBP/GIF, tối đa 5MB. Ảnh nên nằm ngang (vd. 1600×500) để không bị crop xấu.
      </p>
    </div>
  );
}
