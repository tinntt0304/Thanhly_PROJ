import Link from "next/link";
import { requireAdmin } from "@/lib/admin-guard";
import { signOut } from "@/lib/auth";

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/admin" className="font-semibold">
              Quản lý
            </Link>
            <Link href="/admin/products/new" className="text-neutral-500 hover:text-neutral-800">
              + Đăng sản phẩm
            </Link>
            <Link href="/admin/settings" className="text-neutral-500 hover:text-neutral-800">
              Bằng chứng uy tín
            </Link>
            <Link href="/" className="text-neutral-500 hover:text-neutral-800">
              Xem trang công khai
            </Link>
          </nav>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button type="submit" className="text-sm text-neutral-500 hover:text-neutral-800">
              Đăng xuất
            </button>
          </form>
        </div>
      </header>
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</div>
    </div>
  );
}
