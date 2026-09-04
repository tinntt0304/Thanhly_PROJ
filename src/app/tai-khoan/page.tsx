import { requireBuyer } from "@/lib/buyer-guard";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/auction";
import { SiteHeader } from "@/components/SiteHeader";
import { BuyerAccountInfoForm } from "@/components/BuyerAccountInfoForm";
import { BuyerChangePasswordForm } from "@/components/BuyerChangePasswordForm";

export const dynamic = "force-dynamic";

export default async function BuyerAccountPage() {
  const session = await requireBuyer();
  const buyer = await prisma.buyer.findUniqueOrThrow({ where: { id: session.user.id } });

  return (
    <main className="flex-1">
      <SiteHeader />
      <div className="mx-auto flex max-w-lg flex-col gap-8 px-4 py-6">
        <div>
          <h1 className="font-heading text-lg font-bold text-text">Tài khoản của tôi</h1>
          <p className="mt-1 text-sm text-neutral-700">Xem và sửa thông tin tài khoản, đổi mật khẩu.</p>
        </div>

        <section className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-surface p-4">
          <h2 className="font-heading text-sm font-bold text-text">Thông tin tài khoản</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-neutral-500">Số điện thoại</dt>
            <dd className="text-text">{buyer.phone}</dd>
            <dt className="text-neutral-500">Ngày tạo tài khoản</dt>
            <dd className="text-text">{formatDateTime(buyer.createdAt)}</dd>
          </dl>
          <p className="text-xs text-neutral-500">
            Số điện thoại dùng để đăng nhập nên chưa sửa được ở đây.
          </p>
          <BuyerAccountInfoForm defaultName={buyer.name} />
        </section>

        <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-surface p-4">
          <h2 className="font-heading text-sm font-bold text-text">Đổi mật khẩu</h2>
          <BuyerChangePasswordForm />
        </section>
      </div>
    </main>
  );
}
