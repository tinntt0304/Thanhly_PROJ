import { BuyerLoginForm } from "@/components/BuyerLoginForm";
import { Logo } from "@/components/Logo";

export default async function BuyerLoginPage({ searchParams }: PageProps<"/dang-nhap">) {
  const { next } = await searchParams;
  const nextValue = typeof next === "string" ? next : undefined;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4">
      <Logo size="lg" withTagline href={null} />
      <div className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="font-heading text-lg font-bold text-text">Đăng nhập</h1>
        <BuyerLoginForm next={nextValue} />
      </div>
    </main>
  );
}
