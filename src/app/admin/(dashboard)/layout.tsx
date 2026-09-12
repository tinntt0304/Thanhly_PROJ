import { requireAdmin } from "@/lib/admin-guard";
import { signOut } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { listChatSessions } from "@/lib/actions/chat";
import { countThreadsAwaitingSuperadminReply, hasUnseenSuperadminReply } from "@/lib/actions/support";
import { getCreditBalance } from "@/lib/credits";
import { AdminSidebar } from "@/components/AdminSidebar";
import { OnboardingTour } from "@/components/OnboardingTour";

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();
  const isSuperAdmin = session.user.role === "SUPERADMIN";

  // Badge "Hỗ trợ" ở sidebar gộp cả 2 loại hội thoại superadmin cần trả lời (khách vãng lai +
  // seller, xem SupportPanel.tsx ở /admin/ho-tro) — không gọi listChatSessions()/
  // countThreadsAwaitingSuperadminReply() khi đang là SELLER (đã đổi sang requireSuperAdmin()),
  // tránh bị redirect() giữa chừng lúc render layout.
  const [supportAwaitingCount, creditBalance] = await Promise.all([
    isSuperAdmin
      ? Promise.all([
          listChatSessions().then(
            (sessions) =>
              sessions.filter((s) => s.status === "OPEN" && s.lastMessageSender === "VISITOR").length
          ),
          countThreadsAwaitingSuperadminReply(),
        ]).then(([customerCount, sellerCount]) => customerCount + sellerCount)
      : hasUnseenSuperadminReply().then((has) => (has ? 1 : 0)),
    getCreditBalance(session.user.id),
  ]);

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <div className="flex flex-1 flex-col">
      <OnboardingTour isSuperAdmin={isSuperAdmin} />
      <header className="border-b border-neutral-200 bg-surface px-4 py-3">
        <Logo size="sm" href="/admin" />
      </header>
      <div className="flex flex-1 flex-col sm:flex-row">
        <AdminSidebar
          isSuperAdmin={isSuperAdmin}
          supportAwaitingCount={supportAwaitingCount}
          creditBalance={creditBalance}
          signOutAction={signOutAction}
        />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
