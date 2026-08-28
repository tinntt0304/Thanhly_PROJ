import { redirect } from "next/navigation";
import { OtpVerifyForm } from "@/components/OtpVerifyForm";
import { Logo } from "@/components/Logo";

export default async function VerifyOtpPage({ searchParams }: PageProps<"/admin/verify-otp">) {
  const { email } = await searchParams;
  if (typeof email !== "string" || !email) redirect("/admin/login");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4">
      <Logo size="lg" withTagline href={null} />
      <div className="flex w-full max-w-sm flex-col gap-4">
        <div>
          <h1 className="font-heading text-lg font-bold text-text">Xác minh email</h1>
          <p className="mt-1 text-sm text-neutral-700">
            Mã xác minh gồm 6 số đã được gửi tới <span className="font-medium text-text">{email}</span>. Mã có
            hiệu lực trong 10 phút.
          </p>
        </div>
        <OtpVerifyForm email={email} />
      </div>
    </main>
  );
}
