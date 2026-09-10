"use server";

import { z } from "zod";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { revalidatePath } from "next/cache";
import { broadcast } from "@/lib/realtime";
import {
  sendMessengerMessage,
  listRecentComments,
  replyToComment,
  subscribePageWebhook,
  isPageSubscribedToWebhook,
  type FbConversation,
  type FbMessage,
  type FbComment,
  type ManagedPage,
} from "@/lib/facebook-graph";
import { getCachedConversations, getCachedMessages, syncFacebookInboxFromGraphApi } from "@/lib/facebook-inbox-store";

const WIKI_PATH = "/admin/hop-thu-facebook";
const PAGES_COOKIE = "fb_oauth_pages";

function fbChannel(pageId: string): string {
  return `fb:${pageId}`;
}

export type FacebookConnectionStatus = {
  connected: boolean;
  pageId?: string;
  pageName?: string;
  webhookSubscribed?: boolean;
};

// Không bao giờ trả pageAccessToken về client — chỉ trạng thái kết nối + tên trang hiển thị.
// webhookSubscribed kiểm tra THẬT với Graph API (không chỉ đọc cờ lưu sẵn) — bước tự đăng ký
// webhook lúc kết nối (subscribePageWebhook) có thể đã âm thầm thất bại, nên seller cần thấy
// đúng trạng thái hiện tại để biết có cần bấm "Đăng ký lại" hay không.
export async function getFacebookConnectionStatus(): Promise<FacebookConnectionStatus> {
  const session = await requireAdmin();
  const connection = await prisma.facebookPageConnection.findUnique({ where: { userId: session.user.id } });
  if (!connection) return { connected: false };
  const webhookSubscribed = await isPageSubscribedToWebhook(connection.pageId, connection.pageAccessToken);
  return { connected: true, pageId: connection.pageId, pageName: connection.pageName ?? undefined, webhookSubscribed };
}

// Nút "Đăng ký lại webhook" ở UI khi phát hiện chưa đăng ký — khác subscribePageWebhook() gọi
// tự động lúc OAuth connect (bọc try/catch nuốt lỗi để không chặn flow kết nối), ở đây phải
// trả lỗi thật cho seller thấy nếu vẫn thất bại (vd. thiếu quyền pages_manage_metadata).
export async function resubscribeFacebookWebhook(): Promise<{ success?: true; error?: string }> {
  try {
    const connection = await requireOwnConnection();
    await subscribePageWebhook(connection.pageId, connection.pageAccessToken);
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Đăng ký webhook thất bại." };
  }
}

// Đọc danh sách fanpage đang chờ chọn (route callback OAuth tạm lưu vào cookie khi seller
// quản lý nhiều hơn 1 trang) — trang /admin/hop-thu-facebook đọc hàm này để hiện danh sách.
export async function getPendingFacebookPages(): Promise<Array<{ id: string; name: string }>> {
  await requireAdmin();
  const raw = (await cookies()).get(PAGES_COOKIE)?.value;
  if (!raw) return [];
  try {
    const pages = JSON.parse(raw) as ManagedPage[];
    return pages.map((p) => ({ id: p.id, name: p.name }));
  } catch {
    return [];
  }
}

export async function selectFacebookPage(pageId: string): Promise<{ success?: true; error?: string }> {
  const session = await requireAdmin();
  const cookieStore = await cookies();
  const raw = cookieStore.get(PAGES_COOKIE)?.value;
  if (!raw) return { error: "Danh sách fanpage đã hết hạn, vui lòng kết nối lại." };

  let pages: ManagedPage[];
  try {
    pages = JSON.parse(raw) as ManagedPage[];
  } catch {
    return { error: "Danh sách fanpage không hợp lệ, vui lòng kết nối lại." };
  }

  const page = pages.find((p) => p.id === pageId);
  if (!page) return { error: "Không tìm thấy fanpage đã chọn, vui lòng kết nối lại." };

  await prisma.facebookPageConnection.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, pageId: page.id, pageName: page.name, pageAccessToken: page.accessToken },
    update: { pageId: page.id, pageName: page.name, pageAccessToken: page.accessToken },
  });

  // Đăng ký nhận Webhook (realtime) — lỗi ở đây không chặn kết nối, seller vẫn dùng được qua
  // nút "Làm mới" (backfill), chỉ mất phần tin nhắn tự hiện ra. Chạy song song với backfill
  // lịch sử cũ vào cache, vì đây là 2 việc độc lập.
  await Promise.all([
    subscribePageWebhook(page.id, page.accessToken).catch(() => {}),
    syncFacebookInboxFromGraphApi(page.id, page.accessToken).catch(() => {}),
  ]);

  cookieStore.delete(PAGES_COOKIE);
  revalidatePath(WIKI_PATH);
  return { success: true };
}

export async function disconnectFacebookPage(): Promise<void> {
  const session = await requireAdmin();
  await prisma.facebookPageConnection.deleteMany({ where: { userId: session.user.id } });
  revalidatePath(WIKI_PATH);
}

// userId luôn lấy từ session hiện tại (không nhận tham số) — ranh giới sở hữu tự nhiên, 1
// seller chỉ bao giờ đọc/gửi được đúng qua fanpage của chính mình.
async function requireOwnConnection() {
  const session = await requireAdmin();
  const connection = await prisma.facebookPageConnection.findUnique({ where: { userId: session.user.id } });
  if (!connection) throw new Error("Chưa kết nối fanpage Facebook.");
  return connection;
}

// Nguồn dữ liệu Messenger CHÍNH giờ là cache trong DB của chính app (xem
// src/lib/facebook-inbox-store.ts), đổ vào bởi Webhook + backfill Graph API — không gọi trực
// tiếp Graph API mỗi lần xem nữa. Đọc DB thì mới đủ nhanh để trả lời realtime (Supabase
// Broadcast) chỉ là "tiếng chuông", client phải fetch lại được ngay mà không tính đến giới
// hạn/độ trễ của Graph API.

export async function listFacebookConversations(): Promise<{ items?: FbConversation[]; error?: string }> {
  try {
    const connection = await requireOwnConnection();
    const items = await getCachedConversations(connection.pageId);
    return { items };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Không tải được danh sách hội thoại." };
  }
}

// Bấm "Làm mới" ở UI gọi hàm này — đồng bộ lại từ Graph API (phòng webhook rớt sự kiện) rồi
// mới đọc lại cache, khác với listFacebookConversations() (chỉ đọc cache, dùng cho poll/
// realtime thường xuyên hơn nên phải rẻ, không gọi Graph API mỗi lần).
export async function syncFacebookInbox(): Promise<{ items?: FbConversation[]; error?: string }> {
  try {
    const connection = await requireOwnConnection();
    await syncFacebookInboxFromGraphApi(connection.pageId, connection.pageAccessToken);
    const items = await getCachedConversations(connection.pageId);
    return { items };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Đồng bộ lại hội thoại thất bại." };
  }
}

// Tham số vẫn tên "conversationId" cho khớp phía UI (FacebookInboxPanel.tsx) — thực chất giờ
// truyền vào là participantPsid, vì "hội thoại" = 1 khách ↔ trang, không còn thread id riêng
// của Graph API nữa (xem getCachedConversations()).
export async function listFacebookMessages(conversationId: string): Promise<{ items?: FbMessage[]; error?: string }> {
  try {
    const connection = await requireOwnConnection();
    const items = await getCachedMessages(connection.pageId, conversationId);
    return { items };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Không tải được tin nhắn." };
  }
}

const messageTextSchema = z.string().trim().min(1).max(2000);

export async function sendFacebookMessage(
  recipientPsid: string,
  text: string
): Promise<{ success?: true; error?: string }> {
  const parsed = messageTextSchema.safeParse(text);
  if (!parsed.success) return { error: "Nội dung không hợp lệ." };

  try {
    const connection = await requireOwnConnection();
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

export async function listFacebookComments(): Promise<{ items?: FbComment[]; error?: string }> {
  try {
    const connection = await requireOwnConnection();
    const items = await listRecentComments(connection.pageId, connection.pageAccessToken);
    return { items };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Không tải được bình luận." };
  }
}

export async function replyFacebookComment(
  commentId: string,
  text: string
): Promise<{ success?: true; error?: string }> {
  const parsed = messageTextSchema.safeParse(text);
  if (!parsed.success) return { error: "Nội dung không hợp lệ." };

  try {
    const connection = await requireOwnConnection();
    await replyToComment(commentId, connection.pageAccessToken, parsed.data);
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Trả lời bình luận thất bại." };
  }
}
