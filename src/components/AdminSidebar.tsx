"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  ProductsIcon,
  PlusIcon,
  ImportIcon,
  GalleryIcon,
  MenuIcon,
  StarIcon,
  ChatIcon,
  SearchIcon,
  OrdersIcon,
  WalletIcon,
  EyeIcon,
  LogoutIcon,
  HelpIcon,
  UserIcon,
  InboxIcon,
} from "@/components/icons/AdminFeatureIcons";

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  badge?: number;
  exact?: boolean;
  tourId?: string;
};

function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <Link
      href={item.href}
      data-tour={item.tourId}
      className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
        isActive
          ? "bg-accent-100 font-medium text-accent-700"
          : "text-neutral-700 hover:bg-neutral-100 hover:text-text"
      }`}
    >
      {item.icon}
      <span className="flex-1">{item.label}</span>
      {!!item.badge && item.badge > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-500 px-1 text-xs font-medium text-white">
          {item.badge}
        </span>
      )}
    </Link>
  );
}

export function AdminSidebar({
  isSuperAdmin,
  awaitingReplyCount,
  creditBalance,
  signOutAction,
}: {
  isSuperAdmin: boolean;
  awaitingReplyCount: number;
  creditBalance: number;
  signOutAction: () => Promise<void>;
}) {
  const productItems: NavItem[] = [
    { href: "/admin", label: "Danh sách sản phẩm", icon: <ProductsIcon />, exact: true, tourId: "admin" },
    { href: "/admin/products/new", label: "Đăng sản phẩm", icon: <PlusIcon />, tourId: "products-new" },
    { href: "/admin/products/import", label: "Import Excel", icon: <ImportIcon />, tourId: "products-import" },
    { href: "/admin/thu-vien-anh", label: "Thư viện ảnh", icon: <GalleryIcon />, tourId: "gallery" },
    { href: "/admin/orders", label: "Quản lý đơn hàng", icon: <OrdersIcon />, tourId: "orders" },
    { href: "/admin/nhom-facebook", label: "Tìm nhóm Facebook", icon: <SearchIcon />, tourId: "facebook-groups" },
    { href: "/admin/hop-thu-facebook", label: "Hộp thư Facebook", icon: <InboxIcon />, tourId: "fb-inbox" },
  ];

  const adminItems: NavItem[] = [
    { href: "/admin/danh-muc", label: "Quản lý danh mục", icon: <MenuIcon />, tourId: "categories" },
    { href: "/admin/settings", label: "Bằng chứng uy tín", icon: <StarIcon />, tourId: "trust" },
    { href: "/admin/chat", label: "Chat hỗ trợ", icon: <ChatIcon />, badge: awaitingReplyCount, tourId: "chat" },
  ];

  return (
    <aside className="flex w-full shrink-0 flex-col gap-6 border-neutral-200 bg-surface sm:w-64 sm:border-r">
      <nav className="flex flex-col gap-1 px-3">
        <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Sản phẩm
        </p>
        {productItems.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}

        {isSuperAdmin && (
          <>
            <p className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Quản trị sàn
            </p>
            {adminItems.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </>
        )}
      </nav>

      <div className="mt-auto flex flex-col gap-2 border-t border-neutral-200 px-3 py-3">
        <NavLink item={{ href: "/admin/huong-dan", label: "Hướng dẫn sử dụng", icon: <HelpIcon /> }} />
        <NavLink
          item={{ href: "/admin/account", label: "Tài khoản của tôi", icon: <UserIcon />, tourId: "account" }}
        />
        {!isSuperAdmin && (
          <Link
            href="/admin/nap-credit"
            className="flex items-center gap-3 rounded-md bg-accent-100 px-3 py-2 text-sm font-medium text-accent-700 transition-colors hover:bg-accent-100/70"
          >
            <WalletIcon />
            <span className="flex-1">Số dư credit</span>
            <span>{creditBalance.toLocaleString("vi-VN")}đ</span>
          </Link>
        )}
        <Link
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-text"
        >
          <EyeIcon />
          Xem trang công khai
        </Link>
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-text"
          >
            <LogoutIcon />
            Đăng xuất
          </button>
        </form>
      </div>
    </aside>
  );
}
