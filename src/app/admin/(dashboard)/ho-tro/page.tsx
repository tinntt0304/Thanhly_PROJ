import { requireAdmin } from "@/lib/admin-guard";
import { SupportChatWidget } from "@/components/SupportChatWidget";
import { SupportInboxPanel } from "@/components/SupportInboxPanel";

// SELLER thấy khung chat 1-1 với (các) superadmin để xin hỗ trợ 1 tính năng nào đó — SUPERADMIN
// thấy hộp thư chung (danh sách tất cả seller + chi tiết từng cuộc trò chuyện), y hệt cấu trúc
// /admin/chat (Chat hỗ trợ khách vãng lai) nhưng dành riêng cho seller <-> superadmin.
export default async function SupportPage() {
  const session = await requireAdmin();
  const isSuperAdmin = session.user.role === "SUPERADMIN";

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="font-heading text-lg font-bold text-text">Hỗ trợ</h1>
        <p className="mt-1 text-sm text-neutral-700">
          {isSuperAdmin
            ? "Trả lời yêu cầu hỗ trợ từ người bán trên sàn."
            : "Cần hỗ trợ về 1 tính năng nào đó trên trang admin? Nhắn trực tiếp cho quản trị sàn ở đây."}
        </p>
      </div>
      <div data-tour="support">{isSuperAdmin ? <SupportInboxPanel /> : <SupportChatWidget />}</div>
    </div>
  );
}
