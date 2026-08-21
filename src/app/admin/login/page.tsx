import { LoginForm } from "@/components/LoginForm";
import { Logo } from "@/components/Logo";

export default function AdminLoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4">
      <Logo size="lg" withTagline href={null} />
      <div className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="font-heading text-lg font-bold text-text">Đăng nhập người bán</h1>
        <LoginForm />
      </div>
    </main>
  );
}
