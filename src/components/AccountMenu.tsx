"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// Menu tài khoản DÙNG CHUNG cho 1 loại tài khoản duy nhất (User: SELLER/SUPERADMIN) — không
// còn tách riêng "tài khoản người mua" (Buyer) vs "tài khoản người bán" nữa: ai đăng nhập cũng
// vừa mua (đấu giá/Mua ngay/giỏ hàng) vừa bán (nếu tự đăng sản phẩm) bằng cùng 1 tài khoản.
export function AccountMenu({
  name,
  onSignOut,
}: {
  name: string;
  onSignOut: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full px-2 py-1 text-sm text-neutral-200 transition-colors hover:bg-neutral-800"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-500 text-xs font-bold text-white">
          {name.trim().charAt(0).toUpperCase() || "?"}
        </span>
        <span className="max-w-[8rem] truncate">{name}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-48 overflow-hidden rounded-md border border-neutral-200 bg-surface py-1 text-sm shadow-lg">
          <Link
            href="/admin"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-neutral-700 hover:bg-neutral-100"
          >
            Quản lý bán hàng
          </Link>
          <Link
            href="/admin/account"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-neutral-700 hover:bg-neutral-100"
          >
            Tài khoản của tôi
          </Link>
          <Link
            href="/tai-khoan/don-hang"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-neutral-700 hover:bg-neutral-100"
          >
            Đơn mua
          </Link>
          <form action={onSignOut}>
            <button
              type="submit"
              className="block w-full px-4 py-2 text-left text-neutral-700 hover:bg-neutral-100"
            >
              Đăng xuất
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
