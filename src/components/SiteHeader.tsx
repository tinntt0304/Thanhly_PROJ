import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { getNavLinks } from "@/lib/nav";
import { prisma } from "@/lib/prisma";
import { Logo } from "@/components/Logo";
import { Clock } from "@/components/Clock";
import { AccountMenu } from "@/components/AccountMenu";
import { MobileNavMenu } from "@/components/MobileNavMenu";

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 3h1.386c.51 0 .955.343 1.087.836l2.377 8.921A1.125 1.125 0 007.18 13.5h9.982a1.125 1.125 0 001.12-1.243l-.982-6a1.125 1.125 0 00-1.12-1.007H5.106M9 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm9 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"
      />
    </svg>
  );
}

// Chỉ 1 loại tài khoản duy nhất (User: SELLER/SUPERADMIN, đăng ký/đăng nhập ở /admin/register,
// /admin/login) dùng chung cho cả mua lẫn bán — không còn tài khoản người mua (Buyer) riêng.
// Đã đăng nhập thì luôn mua được (giỏ hàng, đấu giá, Mua ngay) kể cả sản phẩm của người bán
// khác, và menu tài khoản có lối vào "Quản lý bán hàng" nếu muốn tự đăng sản phẩm.
export async function SiteHeader() {
  const [navLinks, session] = await Promise.all([getNavLinks(), auth()]);
  const cartCount = session
    ? await prisma.cartItem.count({ where: { buyerId: session.user.id } })
    : 0;

  const displayName = session ? session.user.name || session.user.email || "Tài khoản" : null;
  const onSignOut = async () => {
    "use server";
    await signOut({ redirectTo: "/" });
  };

  const cartLink = session && (
    <Link
      href="/gio-hang"
      className="relative flex h-9 w-9 items-center justify-center rounded-full text-neutral-200 transition-colors hover:bg-neutral-800 hover:text-white"
    >
      <CartIcon />
      {cartCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-500 px-1 text-[10px] font-bold leading-none text-white">
          {cartCount > 99 ? "99+" : cartCount}
        </span>
      )}
    </Link>
  );
  const loginLink = (
    <Link
      href="/admin/login"
      className="rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600"
    >
      Đăng nhập / Đăng ký
    </Link>
  );

  // Desktop (từ sm trở lên): giữ nguyên menu tài khoản dạng dropdown riêng như cũ.
  const desktopTrailing = session ? (
    <div className="flex items-center gap-2">
      {cartLink}
      <AccountMenu name={displayName!} onSignOut={onSignOut} />
    </div>
  ) : (
    loginLink
  );

  // Mobile: tên tài khoản chỉ hiển thị (không bấm được riêng) — các mục của menu tài khoản
  // (Quản lý bán hàng/Tài khoản/Đơn mua/Đăng xuất) đã gộp vào chung dropdown của icon ≡
  // (MobileNavMenu) thay vì có dropdown riêng thứ 2, xem prop account bên dưới.
  const mobileTrailing = session ? (
    <div className="flex items-center gap-2">
      {cartLink}
      <span className="flex items-center gap-2 rounded-full px-2 py-1 text-sm text-neutral-200">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-500 text-xs font-bold text-white">
          {displayName!.trim().charAt(0).toUpperCase() || "?"}
        </span>
        <span className="max-w-[6rem] truncate">{displayName}</span>
      </span>
    </div>
  ) : (
    loginLink
  );

  return (
    <header className="relative bg-neutral-900">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3 sm:gap-6">
          <MobileNavMenu navLinks={navLinks} account={session ? { name: displayName!, onSignOut } : null} />
          <Logo size="sm" onDark />
          <nav className="hidden flex-wrap items-center gap-5 text-sm text-neutral-200 sm:flex">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className="transition-colors hover:text-white">
                {link.label}
              </Link>
            ))}
          </nav>
          {/* Mobile: giỏ hàng + tên tài khoản gom về cùng cụm với logo/icon menu, thay vì đẩy
              sang rìa phải như trước. */}
          <div className="sm:hidden">{mobileTrailing}</div>
        </div>

        <div className="hidden items-center gap-4 sm:flex">
          <Clock className="text-neutral-50" />
          {desktopTrailing}
        </div>
      </div>
    </header>
  );
}
