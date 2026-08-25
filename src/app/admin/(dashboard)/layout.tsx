import { requireAdmin } from "@/lib/admin-guard";
import { signOut } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { listChatSessions } from "@/lib/actions/chat";
import { getCreditBalance } from "@/lib/credits";
import { AdminSidebar } from "@/components/AdminSidebar";

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();
  const isSuperAdmin = session.user.role === "SUPERADMIN";

  // Chat hỗ trợ là hộp thư chung của cả sàn (chỉ superadmin) — không gọi listChatSessions()
  // (đã đổi sang requireSuperAdmin() trong chat.ts) khi đang là SELLER, tránh bị redirect()
  // giữa chừng lúc render layout.
  const [awaitingReplyCount, creditBalance] = await Promise.all([
    isSuperAdmin
      ? listChatSessions().then(
          (sessions) =>
            sessions.filter((s) => s.status === "OPEN" && s.lastMessageSender === "VISITOR").length
        )
      : Promise.resolve(0),
    getCreditBalance(session.user.id),
  ]);

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-neutral-200 bg-surface px-4 py-3">
        <Logo size="sm" href="/admin" />
      </header>
      <div className="flex flex-1 flex-col sm:flex-row">
        <AdminSidebar
          isSuperAdmin={isSuperAdmin}
          awaitingReplyCount={awaitingReplyCount}
          creditBalance={creditBalance}
          signOutAction={signOutAction}
        />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
