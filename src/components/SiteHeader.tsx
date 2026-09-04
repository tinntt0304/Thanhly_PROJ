import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { buyerAuth, buyerSignOut } from "@/lib/buyer-auth";
import { getNavLinks } from "@/lib/nav";
import { prisma } from "@/lib/prisma";
import { Logo } from "@/components/Logo";
import { Clock } from "@/components/Clock";

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 3h1.386c.51 0 .955.343 1.087.836l2.377 8.921A1.125 1.125 0 007.18 13.5h9.982a1.125 1.125 0 001.12-1.243l-.982-6a1.125 1.125 0 00-1.12-1.007H5.106M9 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm9 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"
      />
    </svg>
  );
}

export async function SiteHeader() {
  const [navLinks, session, buyerSession] = await Promise.all([getNavLinks(), auth(), buyerAuth()]);
  const cartCount = buyerSession
    ? await prisma.cartItem.count({ where: { buyerId: buyerSession.user.id } })
    : 0;

  return (
    <header className="bg-neutral-900">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3">
        <div className="flex flex-wrap items-center gap-6">
          <Logo size="sm" onDark />
          <nav className="flex flex-wrap items-center gap-5 text-sm text-neutral-200">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className="transition-colors hover:text-white">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <Clock className="hidden text-neutral-50 sm:block" />

          {buyerSession && (
            <div className="flex items-center divide-x divide-neutral-700 rounded-full border border-neutral-700 bg-neutral-800 text-sm text-neutral-200">
              <Link
                href="/gio-hang"
                className="flex items-center gap-1.5 px-3 py-1.5 transition-colors hover:text-white"
              >
                <CartIcon />
                Giỏ hàng{cartCount > 0 ? ` (${cartCount})` : ""}
              </Link>
              <Link href="/tai-khoan/don-hang" className="px-3 py-1.5 transition-colors hover:text-white">
                Đơn hàng
              </Link>
              <Link href="/tai-khoan" className="px-3 py-1.5 transition-colors hover:text-white">
                {buyerSession.user.name || "Tài khoản"}
              </Link>
              <form
                action={async () => {
                  "use server";
                  await buyerSignOut({ redirectTo: "/" });
                }}
              >
                <button type="submit" className="px-3 py-1.5 transition-colors hover:text-white">
                  Đăng xuất
                </button>
              </form>
            </div>
          )}

          {session && (
            <div className="flex items-center gap-3 text-sm text-neutral-200">
              <span className="hidden sm:inline">{session.user.name || session.user.email}</span>
              <Link
                href="/admin"
                className="rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600"
              >
                Quản lý bán hàng
              </Link>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <button
                  type="submit"
                  className="rounded-md border border-neutral-600 px-4 py-2 text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-800"
                >
                  Đăng xuất
                </button>
              </form>
            </div>
          )}

          {!buyerSession && !session && (
            // 1 khu vực đăng nhập/đăng ký duy nhất cho cả 2 vai trò — không còn 2 nút rời
            // ("Đăng nhập / Đăng ký" + "Người bán") đứng cạnh nhau gây hiểu lầm. Trang đích
            // /dang-nhap có sẵn tab chuyển sang "Người bán" nếu cần, xem AuthAudienceTabs.
            <Link
              href="/dang-nhap"
              className="rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600"
            >
              Đăng nhập / Đăng ký
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
