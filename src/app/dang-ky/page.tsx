import { BuyerRegisterForm } from "@/components/BuyerRegisterForm";
import { AuthAudienceTabs } from "@/components/AuthAudienceTabs";
import { Logo } from "@/components/Logo";

export default async function BuyerRegisterPage({ searchParams }: PageProps<"/dang-ky">) {
  const { next } = await searchParams;
  const nextValue = typeof next === "string" ? next : undefined;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4">
      <Logo size="lg" withTagline href={null} />
      <div className="flex w-full max-w-sm flex-col gap-4">
        <AuthAudienceTabs active="buyer" mode="register" />
        <h1 className="font-heading text-lg font-bold text-text">Đăng ký tài khoản</h1>
        <BuyerRegisterForm next={nextValue} />
      </div>
    </main>
  );
}
