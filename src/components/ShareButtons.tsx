"use client";

import { useEffect, useState } from "react";

type ShareButtonsProps = {
  url: string;
  title: string;
};

/**
 * Zalo không có sharer URL công khai ổn định như Facebook (`sharer.php`), nên dùng
 * Web Share API cho "Chia sẻ khác" — trên Android/iOS nó liệt kê cả app Zalo nếu đã
 * cài, còn desktop không hỗ trợ thì ẩn nút và chỉ còn Facebook + sao chép link.
 */
export function ShareButtons({ url, title }: ShareButtonsProps) {
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [copied, setCopied] = useState(false);

  // Chỉ biết được navigator.share có tồn tại hay không sau khi hydrate ở client — giữ
  // state ban đầu là false để khớp với server render, tránh lệch hydration.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- đồng bộ 1 lần lúc mount với API của trình duyệt, không có gì để await
    setCanNativeShare(typeof navigator.share === "function");
  }, []);

  const facebookHref = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;

  async function handleNativeShare() {
    try {
      await navigator.share({ title, url });
    } catch {
      // Người dùng bấm huỷ hộp thoại chia sẻ — không cần xử lý gì thêm.
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Trình duyệt chặn clipboard API — bỏ qua, người dùng có thể copy link thủ công.
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-neutral-700">Chia sẻ:</span>

      <a
        href={facebookHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chia sẻ lên Facebook"
        className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#1877F2] text-white transition-opacity hover:opacity-90"
      >
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 fill-current" aria-hidden="true">
          <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06C2 17.08 5.66 21.24 10.44 22v-7.03H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.88h2.78l-.44 2.91h-2.34V22C18.34 21.24 22 17.08 22 12.06Z" />
        </svg>
      </a>

      {canNativeShare && (
        <button
          type="button"
          onClick={handleNativeShare}
          aria-label="Chia sẻ qua Zalo hoặc ứng dụng khác"
          className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
            <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L7.04 9.81C6.5 9.31 5.79 9 5 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z" />
          </svg>{" "}
          Zalo / Khác
        </button>
      )}

      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
      >
        <span aria-hidden="true">🔗</span> {copied ? "Đã sao chép ✓" : "Sao chép link"}
      </button>
    </div>
  );
}
