import Link from "next/link";
import { RegisterForm } from "@/components/RegisterForm";
import { AuthAudienceTabs } from "@/components/AuthAudienceTabs";
import { Logo } from "@/components/Logo";

export default function RegisterPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-10">
      <Logo size="lg" withTagline href={null} />
      <div className="flex w-full max-w-sm flex-col gap-4">
        <AuthAudienceTabs active="seller" mode="register" />
        <div>
          <h1 className="font-heading text-lg font-bold text-text">Đăng ký làm người bán</h1>
          <p className="mt-1 text-sm text-neutral-700">
            Tạo tài khoản để tự đăng sản phẩm của bạn lên đấu giá.
          </p>
        </div>
        <RegisterForm />
        <p className="text-sm text-neutral-700">
          Đã có tài khoản?{" "}
          <Link href="/admin/login" className="text-accent-600 underline">
            Đăng nhập
          </Link>
        </p>
      </div>
    </main>
  );
}
