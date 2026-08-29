import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/auction";
import { AccountInfoForm } from "@/components/AccountInfoForm";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  SUPERADMIN: "Superadmin",
  SELLER: "Người bán",
};

export default async function AccountPage() {
  const session = await requireAdmin();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });

  return (
    <div className="flex max-w-lg flex-col gap-8">
      <div>
        <h1 className="font-heading text-lg font-bold text-text">Tài khoản của tôi</h1>
        <p className="mt-1 text-sm text-neutral-700">Xem và sửa thông tin tài khoản, đổi mật khẩu.</p>
      </div>

      <section className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-surface p-4">
        <h2 className="font-heading text-sm font-bold text-text">Thông tin tài khoản</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-neutral-500">Email</dt>
          <dd className="text-text">{user.email}</dd>
          <dt className="text-neutral-500">Vai trò</dt>
          <dd className="text-text">{ROLE_LABEL[user.role] ?? user.role}</dd>
          <dt className="text-neutral-500">Ngày tạo tài khoản</dt>
          <dd className="text-text">{formatDateTime(user.createdAt)}</dd>
        </dl>
        <p className="text-xs text-neutral-500">
          Email dùng để đăng nhập nên chưa sửa được ở đây — liên hệ quản trị viên nếu cần đổi.
        </p>
        <AccountInfoForm defaultName={user.name} defaultPhone={user.phone ?? ""} />
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-surface p-4">
        <h2 className="font-heading text-sm font-bold text-text">Đổi mật khẩu</h2>
        <ChangePasswordForm />
      </section>
    </div>
  );
}
