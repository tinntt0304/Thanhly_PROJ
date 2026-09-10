// Đọc/ghi cache Messenger trong DB của chính app (FacebookMessage/FacebookParticipant ở
// schema.prisma) — nguồn dữ liệu CHÍNH cho /admin/hop-thu-facebook, đổ vào bởi Webhook
// (src/app/api/webhooks/facebook/route.ts) + backfill Graph API. Tách riêng khỏi
// src/lib/actions/facebook-inbox.ts (file "use server") vì Webhook route cũng cần gọi các hàm
// ghi cache này — nếu để chung file "use server", các hàm này sẽ tự động trở thành Server
// Action gọi được từ client, mà chúng nhận trực tiếp pageAccessToken làm tham số (client gọi
// được thì có thể ép server proxy request bằng token bất kỳ, hoặc ghi đè cache của trang khác).
// File này KHÔNG tự kiểm tra quyền — nơi gọi (Server Action qua requireOwnConnection(), hoặc
// Webhook route đã tự xác minh chữ ký Facebook) chịu trách nhiệm đó.
import { prisma } from "@/lib/prisma";
import {
  listConversations,
  listMessages,
  fetchParticipantProfile,
  subscribePageWebhook,
  type FbConversation,
  type FbMessage,
  type FbAttachmentType,
  type ManagedPage,
} from "@/lib/facebook-graph";

type AttachmentInput = { type: FbAttachmentType; url: string } | null;

// Lưu kết nối fanpage + đăng ký webhook + backfill lịch sử cũ — dùng CHUNG cho cả 2 nơi seller
// có thể kết nối: OAuth callback (tự kết nối luôn khi seller chỉ quản lý đúng 1 trang, xem
// src/app/api/auth/facebook/callback/route.ts) VÀ màn chọn trang khi quản lý nhiều trang (xem
// selectFacebookPage ở src/lib/actions/facebook-inbox.ts). Tách hàm chung để tránh lặp lại —
// trước đây callback route tự upsert riêng, thiếu hẳn 2 bước subscribePageWebhook/backfill,
// khiến seller chỉ có 1 trang (trường hợp phổ biến nhất) không bao giờ nhận được tin nhắn
// realtime cho tới khi tự bấm "Đăng ký lại webhook".
//
// Upsert theo pageId (không phải userId) — 1 seller giờ kết nối được NHIỀU fanpage, pageId mới
// là khoá duy nhất thật của 1 kết nối (xem FacebookPageConnection ở schema.prisma). "Kết nối
// lại" đúng 1 trang đã có sẽ tự gán về đúng userId đang thao tác (vd. token cũ hết hạn, seller
// chạy lại OAuth cho trang đó).
export async function connectFacebookPage(userId: string, page: ManagedPage): Promise<void> {
  await prisma.facebookPageConnection.upsert({
    where: { pageId: page.id },
    create: { userId, pageId: page.id, pageName: page.name, pageAccessToken: page.accessToken },
    update: { userId, pageName: page.name, pageAccessToken: page.accessToken },
  });

  // Lỗi ở đây không nên chặn việc kết nối — seller vẫn dùng được (chỉ mất phần realtime/lịch
  // sử cũ), có thể tự sửa lại sau qua nút "Đăng ký lại webhook"/"Làm mới" ở UI.
  await Promise.all([
    subscribePageWebhook(page.id, page.accessToken).catch(() => {}),
    syncFacebookInboxFromGraphApi(page.id, page.accessToken).catch(() => {}),
  ]);
}

export async function getCachedConversations(pageId: string): Promise<FbConversation[]> {
  // "Distinct + orderBy" của Prisma trả ĐÚNG 1 dòng mới nhất cho mỗi psid — cách chuẩn để lấy
  // "tin nhắn cuối của mỗi hội thoại" mà không cần raw SQL.
  const latestPerPsid = await prisma.facebookMessage.findMany({
    where: { pageId },
    orderBy: { createdAt: "desc" },
    distinct: ["psid"],
  });
  const participants = await prisma.facebookParticipant.findMany({ where: { pageId } });
  const byPsid = new Map(participants.map((p) => [p.psid, p]));

  return latestPerPsid
    .map((m) => {
      const p = byPsid.get(m.psid);
      return {
        id: m.psid,
        updatedAt: m.createdAt.toISOString(),
        snippet: m.direction === "OUT" ? `Bạn: ${m.message}` : m.message,
        participantName: p?.name ?? null,
        participantPsid: m.psid,
        avatarUrl: p?.avatarUrl ?? null,
      };
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function getCachedMessages(pageId: string, psid: string): Promise<FbMessage[]> {
  const rows = await prisma.facebookMessage.findMany({
    where: { pageId, psid },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    message: r.message,
    fromId: r.direction === "IN" ? psid : "page",
    fromName: null,
    createdAt: r.createdAt.toISOString(),
    attachmentType: r.attachmentType,
    attachmentUrl: r.attachmentUrl,
  }));
}

// Ghi 1 tin nhắn KHÁCH gửi (webhook) vào cache — upsert theo mid nên webhook gửi lại (Facebook
// retry khi timeout) vẫn an toàn, không tạo trùng.
export async function recordIncomingMessage(
  pageId: string,
  psid: string,
  mid: string,
  message: string,
  createdAt: Date,
  attachment: AttachmentInput = null
): Promise<void> {
  await prisma.facebookMessage.upsert({
    where: { id: mid },
    create: {
      id: mid,
      pageId,
      psid,
      direction: "IN",
      message,
      createdAt,
      attachmentType: attachment?.type,
      attachmentUrl: attachment?.url,
    },
    update: {},
  });
}

// Cache tên/avatar khách theo trang, tự làm mới lại sau 24h (tên/ảnh Facebook có thể đổi) —
// tránh gọi Graph API riêng cho từng người mỗi lần hiển thị danh sách như cách cũ.
export async function upsertParticipantIfStale(pageId: string, psid: string, pageAccessToken: string): Promise<void> {
  const existing = await prisma.facebookParticipant.findUnique({ where: { pageId_psid: { pageId, psid } } });
  const isStale = !existing || Date.now() - existing.updatedAt.getTime() > 24 * 3600_000;
  if (!isStale) return;

  const profile = await fetchParticipantProfile(psid, pageAccessToken);
  await prisma.facebookParticipant.upsert({
    where: { pageId_psid: { pageId, psid } },
    create: { pageId, psid, name: profile.name, avatarUrl: profile.avatarUrl },
    update: { name: profile.name, avatarUrl: profile.avatarUrl },
  });
}

// Đồng bộ lại TOÀN BỘ lịch sử hội thoại từ Graph API vào cache DB — dùng lúc mới kết nối trang
// (webhook chỉ báo tin nhắn PHÁT SINH SAU khi đăng ký, không có lịch sử cũ) và cho nút
// "Làm mới" ở UI (phòng khi webhook bị lỗi/rớt sự kiện). Ghi đè theo mid (id message thật của
// Facebook) nên chạy lại nhiều lần vẫn an toàn, không tạo trùng.
export async function syncFacebookInboxFromGraphApi(pageId: string, pageAccessToken: string): Promise<void> {
  const conversations = await listConversations(pageId, pageAccessToken);

  for (const conv of conversations) {
    if (!conv.participantPsid) continue;
    const psid = conv.participantPsid;

    await prisma.facebookParticipant.upsert({
      where: { pageId_psid: { pageId, psid } },
      create: { pageId, psid, name: conv.participantName, avatarUrl: conv.avatarUrl },
      update: { name: conv.participantName, avatarUrl: conv.avatarUrl },
    });

    const messages = await listMessages(conv.id, pageAccessToken);
    if (messages.length === 0) continue;

    await prisma.$transaction(
      messages.map((m) =>
        prisma.facebookMessage.upsert({
          where: { id: m.id },
          create: {
            id: m.id,
            pageId,
            psid,
            direction: m.fromId && m.fromId !== psid ? "OUT" : "IN",
            message: m.message,
            createdAt: new Date(m.createdAt),
            attachmentType: m.attachmentType,
            attachmentUrl: m.attachmentUrl,
          },
          update: {},
        })
      )
    );
  }
}
