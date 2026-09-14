"use client";

import { useState } from "react";
import Link from "next/link";
import type { NavLink } from "@/lib/nav";

// Chỉ hiện ở màn hình nhỏ (sm:hidden) — icon 3 gạch bên trái header, bấm vào xổ ra danh sách
// link điều hướng dạng dropdown ngay dưới header. Ở màn hình từ sm trở lên, SiteHeader tự hiện
// nav dạng hàng ngang như cũ (không dùng component này).
export function MobileNavMenu({ navLinks }: { navLinks: NavLink[] }) {
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
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-md px-2 py-2 transition-colors hover:bg-neutral-800 hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
