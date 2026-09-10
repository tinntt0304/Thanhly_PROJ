"use server";

import { z } from "zod";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { revalidatePath } from "next/cache";
import { broadcast } from "@/lib/realtime";
import {
  sendMessengerMessage,
  sendMessengerImage,
  listRecentComments,
  replyToComment,
  subscribePageWebhook,
  isPageSubscribedToWebhook,
  type FbConversation,
  type FbMessage,
  type FbComment,
  type ManagedPage,
} from "@/lib/facebook-graph";
import {
  getCachedConversations,
  getCachedMessages,
  syncFacebookInboxFromGraphApi,
  connectFacebookPage,
} from "@/lib/facebook-inbox-store";
import { uploadFacebookAttachmentImage } from "@/lib/storage";

const INBOX_PATH = "/admin/hop-thu-facebook";
const SETTINGS_PATH = "/admin/cai-dat";
const PAGES_COOKIE = "fb_oauth_pages";

// Kết nối/ngắt kết nối làm thay đổi dữ liệu hiển thị ở CẢ 2 trang: /admin/cai-dat (trạng thái
// kết nối) và /admin/hop-thu-facebook (danh sách tab fanpage) — revalidate cả 2.
function revalidateFacebookPaths() {
  revalidatePath(SETTINGS_PATH);
  revalidatePath(INBOX_PATH);
}

function fbChannel(pageId: string): string {
  return `fb:${pageId}`;
}

export type FacebookPageConnectionInfo = {
  pageId: string;
  pageName: string | null;
  webhookSubscribed: boolean;
};

// Không bao giờ trả pageAccessToken về client — chỉ trạng thái kết nối + tên trang hiển thị.
// 1 seller có thể kết nối NHIỀU fanpage (xem FacebookPageConnection ở schema.prisma) — trả về
// danh sách đầy đủ, không còn "1 kết nối duy nhất" như trước. webhookSubscribed kiểm tra THẬT
// với Graph API (không chỉ đọc cờ lưu sẵn) cho từng trang — bước tự đăng ký webhook lúc kết
// nối (subscribePageWebhook) có thể đã âm thầm thất bại, seller cần thấy đúng trạng thái hiện
// tại để biết trang nào cần bấm "Đăng ký lại".
export async function listFacebookPageConnections(): Promise<FacebookPageConnectionInfo[]> {
  const session = await requireAdmin();
  const connections = await prisma.facebookPageConnection.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });
  return Promise.all(
    connections.map(async (c) => ({
      pageId: c.pageId,
      pageName: c.pageName,
      webhookSubscribed: await isPageSubscribedToWebhook(c.pageId, c.pageAccessToken),
    }))
  );
}

// Nút "Đăng ký lại webhook" ở UI khi phát hiện chưa đăng ký — khác subscribePageWebhook() gọi
// tự động lúc OAuth connect (bọc try/catch nuốt lỗi để không chặn flow kết nối), ở đây phải
// trả lỗi thật cho seller thấy nếu vẫn thất bại (vd. thiếu quyền pages_manage_metadata).
export async function resubscribeFacebookWebhook(pageId: string): Promise<{ success?: true; error?: string }> {
  try {
    const connection = await requireOwnConnection(pageId);
    await subscribePageWebhook(connection.pageId, connection.pageAccessToken);
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Đăng ký webhook thất bại." };
  }
}

// Đọc danh sách fanpage đang chờ chọn (route callback OAuth tạm lưu vào cookie) — đã lọc bỏ
// những trang seller ĐÃ kết nối rồi (chạy lại OAuth để thêm fanpage MỚI, không cần chọn lại
// trang cũ). Trang /admin/cai-dat đọc hàm này để hiện danh sách cho chọn (hỗ trợ chọn nhiều).
export async function getPendingFacebookPages(): Promise<Array<{ id: string; name: string }>> {
  const session = await requireAdmin();
  const raw = (await cookies()).get(PAGES_COOKIE)?.value;
  if (!raw) return [];
  try {
    const pages = JSON.parse(raw) as ManagedPage[];
    const existing = await prisma.facebookPageConnection.findMany({
      where: { userId: session.user.id },
      select: { pageId: true },
    });
    const connectedIds = new Set(existing.map((c) => c.pageId));
    return pages.filter((p) => !connectedIds.has(p.id)).map((p) => ({ id: p.id, name: p.name }));
  } catch {
    return [];
  }
}

// Chọn 1 hoặc nhiều fanpage (checkbox ở /admin/cai-dat) — UI gọi hàm này riêng cho MỖI trang
// đã tick, không cần 1 action nhận cả mảng vì mỗi lượt kết nối là 1 việc độc lập (trang này
// lỗi không nên chặn trang khác).
export async function selectFacebookPage(pageId: string): Promise<{ success?: true; error?: string }> {
  const session = await requireAdmin();
  const raw = (await cookies()).get(PAGES_COOKIE)?.value;
  if (!raw) return { error: "Danh sách fanpage đã hết hạn, vui lòng kết nối lại." };

  let pages: ManagedPage[];
  try {
    pages = JSON.parse(raw) as ManagedPage[];
  } catch {
    return { error: "Danh sách fanpage không hợp lệ, vui lòng kết nối lại." };
  }

  const page = pages.find((p) => p.id === pageId);
  if (!page) return { error: "Không tìm thấy fanpage đã chọn, vui lòng kết nối lại." };

  try {
    await connectFacebookPage(session.user.id, page);
    revalidateFacebookPaths();
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Kết nối fanpage thất bại." };
  }
}

// Xoá cookie danh sách fanpage đang chờ chọn — gọi sau khi seller đã chọn xong (hết nhu cầu
// chọn thêm) ở /admin/cai-dat, khác selectFacebookPage() (có thể gọi lại nhiều lần để chọn
// nhiều trang, không tự xoá cookie sau mỗi lần chọn).
export async function clearPendingFacebookPages(): Promise<void> {
  await requireAdmin();
  (await cookies()).delete(PAGES_COOKIE);
}

export async function disconnectFacebookPage(pageId: string): Promise<void> {
  const session = await requireAdmin();
  await prisma.facebookPageConnection.deleteMany({ where: { pageId, userId: session.user.id } });
  revalidateFacebookPaths();
}

// pageId luôn đối chiếu với userId của session hiện tại — ranh giới sở hữu tự nhiên, 1 seller
// chỉ bao giờ đọc/gửi được đúng qua fanpage CỦA CHÍNH MÌNH, dù có truyền đúng pageId của
// fanpage người khác cũng không lấy được token của họ.
async function requireOwnConnection(pageId: string) {
  const session = await requireAdmin();
  const connection = await prisma.facebookPageConnection.findFirst({ where: { pageId, userId: session.user.id } });
  if (!connection) throw new Error("Không tìm thấy fanpage này trong danh sách đã kết nối của bạn.");
  return connection;
}

// Nguồn dữ liệu Messenger CHÍNH giờ là cache trong DB của chính app (xem
// src/lib/facebook-inbox-store.ts), đổ vào bởi Webhook + backfill Graph API — không gọi trực
// tiếp Graph API mỗi lần xem nữa. Đọc DB thì mới đủ nhanh để trả lời realtime (Supabase
// Broadcast) chỉ là "tiếng chuông", client phải fetch lại được ngay mà không tính đến giới
// hạn/độ trễ của Graph API.

export async function listFacebookConversations(pageId: string): Promise<{ items?: FbConversation[]; error?: string }> {
  try {
    const connection = await requireOwnConnection(pageId);
    const items = await getCachedConversations(connection.pageId);
    return { items };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Không tải được danh sách hội thoại." };
  }
}

// Bấm "Làm mới" ở UI gọi hàm này — đồng bộ lại từ Graph API (phòng webhook rớt sự kiện) rồi
// mới đọc lại cache, khác với listFacebookConversations() (chỉ đọc cache, dùng cho poll/
// realtime thường xuyên hơn nên phải rẻ, không gọi Graph API mỗi lần).
export async function syncFacebookInbox(pageId: string): Promise<{ items?: FbConversation[]; error?: string }> {
  try {
    const connection = await requireOwnConnection(pageId);
    await syncFacebookInboxFromGraphApi(connection.pageId, connection.pageAccessToken);
    const items = await getCachedConversations(connection.pageId);
    return { items };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Đồng bộ lại hội thoại thất bại." };
  }
}

// "conversationId" (khớp tên tham số phía UI, FacebookInboxPanel.tsx) thực chất là
// participantPsid, vì "hội thoại" = 1 khách ↔ 1 trang, không còn thread id riêng của Graph
// API nữa (xem getCachedConversations()) — luôn kèm pageId để biết đọc đúng trang nào.
export async function listFacebookMessages(
  pageId: string,
  conversationId: string
): Promise<{ items?: FbMessage[]; error?: string }> {
  try {
    const connection = await requireOwnConnection(pageId);
    const items = await getCachedMessages(connection.pageId, conversationId);
    return { items };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Không tải được tin nhắn." };
  }
}

const messageTextSchema = z.string().trim().min(1).max(2000);

export async function sendFacebookMessage(
  pageId: string,
  recipientPsid: string,
  text: string
): Promise<{ success?: true; error?: string }> {
  const parsed = messageTextSchema.safeParse(text);
  if (!parsed.success) return { error: "Nội dung không hợp lệ." };

  try {
    const connection = await requireOwnConnection(pageId);
    const messageId = await sendMessengerMessage(
      connection.pageId,
      connection.pageAccessToken,
      recipientPsid,
      parsed.data
    );

    // Ghi lại ngay vào cache của app — không chờ webhook (webhook không báo lại tin PAGE tự
    // gửi vì app chỉ đăng ký field "messages", không đăng ký "messaging_echoes").
    await prisma.facebookMessage.create({
      data: {
        id: messageId,
        pageId: connection.pageId,
        psid: recipientPsid,
        direction: "OUT",
        message: parsed.data,
        createdAt: new Date(),
      },
    });
    await broadcast(fbChannel(connection.pageId), "message");

    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gửi tin nhắn thất bại." };
  }
}

// Seller chọn ảnh từ máy → upload lên Supabase Storage lấy URL public → đưa URL đó vào Send
// API (Facebook tự tải ảnh về từ URL này, app không tự làm multipart upload trực tiếp lên
// Graph API). Ảnh gửi đi được giữ lại (bucket facebook-attachments) làm lịch sử hội thoại,
// hiển thị y hệt ảnh khách gửi (xem attachmentUrl ở FacebookMessage).
export async function sendFacebookImage(
  pageId: string,
  recipientPsid: string,
  formData: FormData
): Promise<{ success?: true; error?: string }> {
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return { error: "Chưa chọn ảnh." };

  try {
    const session = await requireAdmin();
    const connection = await requireOwnConnection(pageId);
    const imageUrl = await uploadFacebookAttachmentImage(file, session.user.id);
    const messageId = await sendMessengerImage(connection.pageId, connection.pageAccessToken, recipientPsid, imageUrl);

    await prisma.facebookMessage.create({
      data: {
        id: messageId,
        pageId: connection.pageId,
        psid: recipientPsid,
        direction: "OUT",
        message: "🖼️ Đã gửi hình ảnh",
        attachmentType: "IMAGE",
        attachmentUrl: imageUrl,
        createdAt: new Date(),
      },
    });
    await broadcast(fbChannel(connection.pageId), "message");

    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gửi ảnh thất bại." };
  }
}

export async function listFacebookComments(pageId: string): Promise<{ items?: FbComment[]; error?: string }> {
  try {
    const connection = await requireOwnConnection(pageId);
    const items = await listRecentComments(connection.pageId, connection.pageAccessToken);
    return { items };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Không tải được bình luận." };
  }
}

export async function replyFacebookComment(
  pageId: string,
  commentId: string,
  text: string
): Promise<{ success?: true; error?: string }> {
  const parsed = messageTextSchema.safeParse(text);
  if (!parsed.success) return { error: "Nội dung không hợp lệ." };

  try {
    const connection = await requireOwnConnection(pageId);
    await replyToComment(commentId, connection.pageAccessToken, parsed.data);
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Trả lời bình luận thất bại." };
  }
}
