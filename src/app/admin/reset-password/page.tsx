import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";
import { Logo } from "@/components/Logo";

export default async function ResetPasswordPage({ searchParams }: PageProps<"/admin/reset-password">) {
  const { email } = await searchParams;
  if (typeof email !== "string" || !email) redirect("/admin/forgot-password");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4">
      <Logo size="lg" withTagline href={null} />
      <div className="flex w-full max-w-sm flex-col gap-4">
        <div>
          <h1 className="font-heading text-lg font-bold text-text">Đặt lại mật khẩu</h1>
          <p className="mt-1 text-sm text-neutral-700">
            Nếu <span className="font-medium text-text">{email}</span> có tài khoản, mã xác minh gồm 6 số đã được
            gửi tới email này (hiệu lực 10 phút). Nhập mật khẩu mới trước, sau đó nhập mã để hoàn tất.
          </p>
        </div>
        <ResetPasswordForm email={email} />
      </div>
    </main>
  );
}
