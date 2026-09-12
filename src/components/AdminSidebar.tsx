"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useLayoutEffect, useState } from "react";
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
  SettingsIcon,
} from "@/components/icons/AdminFeatureIcons";

const SIDEBAR_COLLAPSED_KEY = "admin_sidebar_collapsed";

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  badge?: number;
  exact?: boolean;
  tourId?: string;
};

function CollapseToggleIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4">
      <path d={collapsed ? "M8 5l5 5-5 5" : "M12 5l-5 5 5 5"} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function NavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = usePathname();
  const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <Link
      href={item.href}
      data-tour={item.tourId}
      title={collapsed ? item.label : undefined}
      className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
        collapsed ? "relative justify-center" : ""
      } ${
        isActive
          ? "bg-accent-100 font-medium text-accent-700"
          : "text-neutral-700 hover:bg-neutral-100 hover:text-text"
      }`}
    >
      {item.icon}
      {!collapsed && <span className="flex-1">{item.label}</span>}
      {!!item.badge && item.badge > 0 && (
        <span
          className={`flex items-center justify-center rounded-full bg-accent-500 font-medium text-white ${
            collapsed
              ? "absolute right-0.5 top-0.5 h-4 min-w-4 px-0.5 text-[10px]"
              : "h-5 min-w-5 px-1 text-xs"
          }`}
        >
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
  const [collapsed, setCollapsed] = useState(false);

  // Đọc trạng thái thu gọn đã lưu lúc mount — đồng bộ hoá 1 lần với trình duyệt (localStorage),
  // cùng cách OnboardingTour đọc "admin_onboarding_seen". Mặc định mở rộng nên không có gì để
  // đọc/set thì cứ giữ nguyên render ban đầu, tránh lệch hydration.
  useLayoutEffect(() => {
    try {
      if (window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1") {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- nhánh đồng bộ hợp lệ của việc khởi tạo 1 lần lúc mount
        setCollapsed(true);
      }
    } catch {
      // localStorage có thể bị chặn (chế độ riêng tư) — mặc định mở rộng, không chặn render.
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // Bỏ qua — chỉ là ghi nhớ tuỳ chọn hiển thị, không ảnh hưởng chức năng chính.
      }
      return next;
    });
  }

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
    <aside
      className={`flex shrink-0 flex-col gap-6 border-neutral-200 bg-surface transition-[width] duration-150 sm:border-r ${
        collapsed ? "w-16" : "w-full sm:w-64"
      }`}
    >
      <div className={`flex px-3 pt-3 ${collapsed ? "justify-center" : "justify-end"}`}>
        <button
          type="button"
          onClick={toggleCollapsed}
          title={collapsed ? "Mở rộng menu" : "Thu gọn menu"}
          className={`flex h-7 shrink-0 items-center justify-center gap-1 rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 ${
            collapsed ? "w-7" : "px-1.5"
          }`}
        >
          <CollapseToggleIcon collapsed={collapsed} />
          {!collapsed && <span className="text-xs font-medium">Thu gọn</span>}
        </button>
      </div>

      <nav className="flex flex-col gap-1 px-3">
        {!collapsed && (
          <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Sản phẩm
          </p>
        )}
        {productItems.map((item) => (
          <NavLink key={item.href} item={item} collapsed={collapsed} />
        ))}

        {isSuperAdmin && (
          <>
            {!collapsed && (
              <p className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Quản trị sàn
              </p>
            )}
            {adminItems.map((item) => (
              <NavLink key={item.href} item={item} collapsed={collapsed} />
            ))}
          </>
        )}
      </nav>

      <div className="mt-auto flex flex-col gap-2 border-t border-neutral-200 px-3 py-3">
        <NavLink item={{ href: "/admin/huong-dan", label: "Hướng dẫn sử dụng", icon: <HelpIcon /> }} collapsed={collapsed} />
        <NavLink
          item={{ href: "/admin/cai-dat", label: "Cài đặt", icon: <SettingsIcon />, tourId: "settings" }}
          collapsed={collapsed}
        />
        <NavLink
          item={{ href: "/admin/account", label: "Tài khoản của tôi", icon: <UserIcon />, tourId: "account" }}
          collapsed={collapsed}
        />
        {!isSuperAdmin && (
          <Link
            href="/admin/nap-credit"
            title={collapsed ? "Số dư credit" : undefined}
            className={`flex items-center gap-3 rounded-md bg-accent-100 px-3 py-2 text-sm font-medium text-accent-700 transition-colors hover:bg-accent-100/70 ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <WalletIcon />
            {!collapsed && (
              <>
                <span className="flex-1">Số dư credit</span>
                <span>{creditBalance.toLocaleString("vi-VN")}đ</span>
              </>
            )}
          </Link>
        )}
        <Link
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          title={collapsed ? "Xem trang công khai" : undefined}
          className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-text ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <EyeIcon />
          {!collapsed && "Xem trang công khai"}
        </Link>
        <form action={signOutAction}>
          <button
            type="submit"
            title={collapsed ? "Đăng xuất" : undefined}
            className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-text ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <LogoutIcon />
            {!collapsed && "Đăng xuất"}
          </button>
        </form>
      </div>
    </aside>
  );
}
