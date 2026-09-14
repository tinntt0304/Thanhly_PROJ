"use client";

import { useState } from "react";
import Link from "next/link";
import type { NavLink } from "@/lib/nav";

const linkClass = "rounded-md px-2 py-2 transition-colors hover:bg-neutral-800 hover:text-white";

export type MobileNavMenuAccount = {
  name: string;
  onSignOut: () => Promise<void>;
};

// Chỉ hiện ở màn hình nhỏ (sm:hidden) — icon 3 gạch bên trái header, bấm vào xổ ra danh sách
// link điều hướng dạng dropdown ngay dưới header. Ở màn hình từ sm trở lên, SiteHeader tự hiện
// nav dạng hàng ngang như cũ (không dùng component này).
//
// account (nếu có) gộp luôn các mục của menu tài khoản (AccountMenu) vào chung dropdown này —
// mobile chỉ còn 1 nút ≡ duy nhất thay vì 2 dropdown riêng biệt (icon menu + tên tài khoản).
// Tên/avatar tài khoản hiển thị ở header lúc này chỉ mang tính hiển thị, không bấm được riêng
// (xem SiteHeader.tsx).
export function MobileNavMenu({
  navLinks,
  account,
}: {
  navLinks: NavLink[];
  account?: MobileNavMenuAccount | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Đóng menu" : "Mở menu"}
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-md text-neutral-200 transition-colors hover:bg-neutral-800 hover:text-white"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
        </svg>
      </button>

      {open && (
        <nav className="absolute inset-x-0 top-full z-40 flex flex-col gap-0.5 border-t border-neutral-800 bg-neutral-900 px-4 py-3 text-sm text-neutral-200 shadow-lg">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className={linkClass}>
              {link.label}
            </Link>
          ))}

          {account && (
            <>
              <div className="my-1 border-t border-neutral-800" />
              <span className="truncate px-2 py-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                {account.name}
              </span>
              <Link href="/admin" onClick={() => setOpen(false)} className={linkClass}>
                Quản lý bán hàng
              </Link>
              <Link href="/admin/account" onClick={() => setOpen(false)} className={linkClass}>
                Tài khoản của tôi
              </Link>
              <Link href="/tai-khoan/don-hang" onClick={() => setOpen(false)} className={linkClass}>
                Đơn mua
              </Link>
              <form action={account.onSignOut}>
                <button type="submit" className={`w-full text-left ${linkClass}`}>
                  Đăng xuất
                </button>
              </form>
            </>
          )}
        </nav>
      )}
    </div>
  );
}
