import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";
import { Logo } from "@/components/Logo";

export default async function AdminLoginPage({ searchParams }: PageProps<"/admin/login">) {
  const { verified } = await searchParams;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4">
      <Logo size="lg" withTagline href={null} />
      <div className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="font-heading text-lg font-bold text-text">Đăng nhập người bán</h1>
        {verified === "1" && (
          <p className="rounded-md bg-accent-2-100 px-3 py-2 text-sm text-accent-2-700">
            Xác minh email thành công — mời bạn đăng nhập.
          </p>
        )}
        <LoginForm />
        <p className="text-sm text-neutral-700">
          Chưa có tài khoản?{" "}
          <Link href="/admin/register" className="text-accent-600 underline">
            Đăng ký làm người bán
          </Link>
        </p>
      </div>
    </main>
  );
}
