import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { getNavLinks } from "@/lib/nav";
import { Logo } from "@/components/Logo";
import { Clock } from "@/components/Clock";

export async function SiteHeader() {
  const [navLinks, session] = await Promise.all([getNavLinks(), auth()]);

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
            <Link
              href="/admin/login"
              className="rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600"
            >
              Người bán
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
