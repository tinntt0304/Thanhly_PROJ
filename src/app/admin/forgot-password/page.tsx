import Link from "next/link";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";
import { Logo } from "@/components/Logo";

export default function ForgotPasswordPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4">
      <Logo size="lg" withTagline href={null} />
      <div className="flex w-full max-w-sm flex-col gap-4">
        <div>
          <h1 className="font-heading text-lg font-bold text-text">Quên mật khẩu</h1>
          <p className="mt-1 text-sm text-neutral-700">
            Nhập email đã đăng ký, hệ thống sẽ gửi mã xác minh gồm 6 số để đặt lại mật khẩu.
          </p>
        </div>
        <ForgotPasswordForm />
        <p className="text-sm text-neutral-700">
          <Link href="/admin/login" className="text-accent-600 underline">
            Quay lại đăng nhập
          </Link>
        </p>
      </div>
    </main>
  );
}
