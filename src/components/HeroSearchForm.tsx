"use client";

import { useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

// Tìm kiếm ngay khi gõ (debounce 300ms), không cần bấm "Tìm kiếm" — cập nhật URL (?q=...) qua
// router.replace nên HomePage (server) tự re-render với initialQuery mới, HomeProductSections
// lọc lại danh sách đã có sẵn (không filter ở DB, xem page.tsx). Xoá hết chữ HOẶC bấm icon "x"
// có sẵn của input type="search" đều bắn cùng 1 sự kiện onChange value="" — xử lý NGAY (không
// chờ debounce) để quay lại trang chủ bình thường (bỏ query khỏi URL) đúng yêu cầu.
export function HeroSearchForm({ defaultQuery = "" }: { defaultQuery?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(defaultQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Đồng bộ lại khi initialQuery đổi từ nơi khác (vd bấm nút Back/Forward của trình duyệt) —
  // tính lại NGAY TRONG RENDER (không dùng useEffect) theo pattern "adjust state while
  // rendering" của React, tránh 1 lượt render thừa với giá trị cũ trước khi effect kịp chạy.
  const [syncedQuery, setSyncedQuery] = useState(defaultQuery);
  if (defaultQuery !== syncedQuery) {
    setSyncedQuery(defaultQuery);
    setValue(defaultQuery);
  }

  function pushQuery(next: string) {
    const trimmed = next.trim();
    router.replace(trimmed ? `${pathname}?q=${encodeURIComponent(trimmed)}` : pathname, { scroll: false });
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    setValue(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (next.trim() === "") {
      pushQuery("");
      return;
    }
    debounceRef.current = setTimeout(() => pushQuery(next), 300);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (debounceRef.current) clearTimeout(debounceRef.current);
        pushQuery(value);
      }}
      className="mt-2 flex w-full max-w-xl gap-2 rounded-xl bg-surface p-2 shadow-lg"
    >
      <input
        type="search"
        value={value}
        onChange={handleChange}
        placeholder="Tìm sản phẩm theo tên..."
        aria-label="Tìm sản phẩm"
        className="min-w-0 flex-1 rounded-lg border-none bg-transparent px-3 py-2.5 text-sm text-text placeholder:text-neutral-500 focus:outline-none"
      />
      <button
        type="submit"
        className="shrink-0 rounded-lg bg-accent-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-600"
      >
        Tìm kiếm
      </button>
    </form>
  );
}
