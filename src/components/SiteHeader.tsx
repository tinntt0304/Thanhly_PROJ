import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { buyerAuth, buyerSignOut } from "@/lib/buyer-auth";
import { getNavLinks } from "@/lib/nav";
import { prisma } from "@/lib/prisma";
import { Logo } from "@/components/Logo";
import { Clock } from "@/components/Clock";

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

          {buyerSession ? (
            <div className="flex items-center gap-3 border-r border-neutral-700 pr-4 text-sm text-neutral-200">
              <Link href="/gio-hang" className="transition-colors hover:text-white">
                Giỏ hàng{cartCount > 0 ? ` (${cartCount})` : ""}
              </Link>
              <Link href="/tai-khoan/don-hang" className="transition-colors hover:text-white">
                Đơn hàng
              </Link>
              <Link href="/tai-khoan" className="transition-colors hover:text-white">
                {buyerSession.user.name || "Tài khoản"}
              </Link>
              <form
                action={async () => {
                  "use server";
                  await buyerSignOut({ redirectTo: "/" });
                }}
              >
                <button type="submit" className="transition-colors hover:text-white">
                  Đăng xuất
                </button>
              </form>
            </div>
          ) : (
            // 1 nút gộp duy nhất thay vì 2 link "Đăng nhập"/"Đăng ký" rời rạc đứng cạnh cụm
            // người bán — dễ gây hiểu lầm "đăng nhập cái gì" (feedback người dùng). Trang đích
            // /dang-nhap có sẵn tab chuyển sang "Người bán" nếu cần, xem AuthAudienceTabs.
            <Link
              href="/dang-nhap"
              className="rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600"
            >
              Đăng nhập / Đăng ký
            </Link>
          )}

          {session ? (
            <div className="flex items-center gap-2">
              <Link
                href="/admin"
                className="rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600"
              >
                Quản lý
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
          ) : (
            // Ghost/outline (không phải nút đặc accent-500) — chủ ý làm nhẹ hơn nút mua hàng ở
            // trên, vì đối tượng chính của trang công khai là người mua, người bán chỉ là lối
            // vào phụ (secondary).
            <Link
              href="/admin/login"
              className="rounded-md border border-neutral-600 px-4 py-2 text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-800"
            >
              Người bán
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
