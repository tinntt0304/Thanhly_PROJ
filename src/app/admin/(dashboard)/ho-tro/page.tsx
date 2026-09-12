import { requireAdmin } from "@/lib/admin-guard";
import { listChatSessions } from "@/lib/actions/chat";
import { countThreadsAwaitingSuperadminReply } from "@/lib/actions/support";
import { SupportChatWidget } from "@/components/SupportChatWidget";
import { SupportPanel } from "@/components/SupportPanel";

// SELLER thấy khung chat 1-1 với (các) superadmin để xin hỗ trợ 1 tính năng nào đó — SUPERADMIN
// thấy hộp thư chung, gộp 2 loại hội thoại (khách vãng lai công khai + seller) vào chung 1
// trang bằng tab (SupportPanel), thay vì tách 2 mục sidebar riêng như trước.
export default async function SupportPage() {
  const session = await requireAdmin();
  const isSuperAdmin = session.user.role === "SUPERADMIN";

  const [customerCount, sellerCount] = isSuperAdmin
    ? await Promise.all([
        listChatSessions().then(
          (sessions) => sessions.filter((s) => s.status === "OPEN" && s.lastMessageSender === "VISITOR").length
        ),
        countThreadsAwaitingSuperadminReply(),
      ])
    : [0, 0];

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="font-heading text-lg font-bold text-text">Hỗ trợ</h1>
        <p className="mt-1 text-sm text-neutral-700">
          {isSuperAdmin
            ? "Trả lời yêu cầu hỗ trợ từ khách hàng và người bán trên sàn."
            : "Cần hỗ trợ về 1 tính năng nào đó trên trang admin? Nhắn trực tiếp cho quản trị sàn ở đây."}
        </p>
      </div>
      <div data-tour="support">
        {isSuperAdmin ? (
          <SupportPanel initialCustomerCount={customerCount} initialSellerCount={sellerCount} />
        ) : (
          <SupportChatWidget />
        )}
      </div>
    </div>
  );
}
