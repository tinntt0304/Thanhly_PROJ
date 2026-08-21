import { LoginForm } from "@/components/LoginForm";

export default function AdminLoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4">
      <h1 className="mb-6 text-lg font-semibold">Đăng nhập người bán</h1>
      <LoginForm />
    </main>
  );
}
