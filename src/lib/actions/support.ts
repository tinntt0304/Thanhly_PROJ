"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireSuperAdmin } from "@/lib/admin-guard";
import { broadcast } from "@/lib/realtime";

// "support-threads": báo superadmin refresh danh sách thread (có thread mới hoặc thread nào đó
// có tin nhắn mới). "support:<threadId>": báo đúng 2 phía (seller + superadmin) đang xem thread
// đó refresh tin nhắn — tách riêng để không phải tải lại TOÀN BỘ danh sách chỉ vì 1 tin ở 1
// thread cụ thể, cùng tinh thần notifyChatUpdate() ở lib/actions/chat.ts.
async function notifySupportUpdate(threadId: string): Promise<void> {
  await Promise.all([broadcast("support-threads", "updated"), broadcast(`support:${threadId}`, "message")]);
}

const contentSchema = z.string().trim().min(1).max(2000);

export type SupportMessageDTO = {
  id: string;
  sender: "SELLER" | "SUPERADMIN";
  content: string;
  createdAt: string;
};

// Seller chỉ có đúng 1 thread duy nhất với (các) superadmin — tự tạo ở lần đầu ghé trang
// /admin/ho-tro, không cần bước "bắt đầu cuộc trò chuyện" riêng như chat khách vãng lai (đã
// có tài khoản + đăng nhập rồi nên không cần thu thập tên/SĐT).
async function getOrCreateOwnThreadId(sellerId: string): Promise<string> {
  const thread = await prisma.supportThread.upsert({
    where: { sellerId },
    create: { sellerId },
    update: {},
  });
  return thread.id;
}

export async function getMySupportThread(): Promise<{ threadId: string; messages: SupportMessageDTO[] }> {
  const session = await requireAdmin();
  const threadId = await getOrCreateOwnThreadId(session.user.id);
  const messages = await prisma.supportMessage.findMany({ where: { threadId }, orderBy: { createdAt: "asc" } });
  return {
    threadId,
    messages: messages.map((m) => ({ id: m.id, sender: m.sender, content: m.content, createdAt: m.createdAt.toISOString() })),
  };
}

export async function sendSupportMessageAsSeller(content: string): Promise<{ error?: string }> {
  const session = await requireAdmin();
  const parsed = contentSchema.safeParse(content);
  if (!parsed.success) return { error: "Nội dung tin nhắn không hợp lệ." };

  const threadId = await getOrCreateOwnThreadId(session.user.id);
  await prisma.$transaction([
    prisma.supportMessage.create({ data: { threadId, sender: "SELLER", content: parsed.data } }),
    prisma.supportThread.update({ where: { id: threadId }, data: { updatedAt: new Date() } }),
  ]);

  await notifySupportUpdate(threadId);
  return {};
}

// Ranh giới sở hữu cho phía superadmin: chỉ cần requireSuperAdmin() (không so khớp sellerId cụ
// thể nào) vì mọi superadmin đều được xem/trả lời CHUNG 1 hộp thư hỗ trợ của cả sàn, khác
// requireOwnConnection ở facebook-inbox.ts (mỗi seller chỉ thấy đúng fanpage của mình).
async function requireExistingThread(threadId: string) {
  const thread = await prisma.supportThread.findUnique({ where: { id: threadId } });
  if (!thread) throw new Error("Không tìm thấy cuộc trò chuyện này.");
  return thread;
}

export async function sendSupportMessageAsSuperadmin(threadId: string, content: string): Promise<{ error?: string }> {
  await requireSuperAdmin();
  const parsed = contentSchema.safeParse(content);
  if (!parsed.success) return { error: "Nội dung tin nhắn không hợp lệ." };

  try {
    await requireExistingThread(threadId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Không tìm thấy cuộc trò chuyện này." };
  }

  await prisma.$transaction([
    prisma.supportMessage.create({ data: { threadId, sender: "SUPERADMIN", content: parsed.data } }),
    prisma.supportThread.update({ where: { id: threadId }, data: { updatedAt: new Date() } }),
  ]);

  await notifySupportUpdate(threadId);
  return {};
}

export async function getSupportThreadMessages(threadId: string): Promise<SupportMessageDTO[]> {
  await requireSuperAdmin();
  const messages = await prisma.supportMessage.findMany({ where: { threadId }, orderBy: { createdAt: "asc" } });
  return messages.map((m) => ({ id: m.id, sender: m.sender, content: m.content, createdAt: m.createdAt.toISOString() }));
}

export type SupportThreadSummaryDTO = {
  id: string;
  sellerName: string;
  sellerEmail: string;
  updatedAt: string;
  lastMessage: string | null;
  lastMessageSender: "SELLER" | "SUPERADMIN" | null;
};

export async function listSupportThreads(): Promise<SupportThreadSummaryDTO[]> {
  await requireSuperAdmin();
  const threads = await prisma.supportThread.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      seller: { select: { name: true, email: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  return threads.map((t) => ({
    id: t.id,
    sellerName: t.seller.name,
    sellerEmail: t.seller.email,
    updatedAt: t.updatedAt.toISOString(),
    lastMessage: t.messages[0]?.content ?? null,
    lastMessageSender: t.messages[0]?.sender ?? null,
  }));
}

// Đếm số thread đang "chờ superadmin trả lời" (tin cuối do seller gửi) — dùng làm badge ở
// sidebar, cùng tinh thần awaitingReplyCount của Chat hỗ trợ khách vãng lai (layout.tsx).
export async function countThreadsAwaitingSuperadminReply(): Promise<number> {
  await requireSuperAdmin();
  const threads = await prisma.supportThread.findMany({
    select: { messages: { orderBy: { createdAt: "desc" }, take: 1, select: { sender: true } } },
  });
  return threads.filter((t) => t.messages[0]?.sender === "SELLER").length;
}

// Badge ở sidebar phía seller: có tin mới từ superadmin mà seller chưa "trả lời lại" (đơn
// giản hoá giống hệt cách awaitingReplyCount phía superadmin hoạt động — không cần cột
// lastReadAt riêng, badge tự tắt khi seller nhắn tiếp).
export async function hasUnseenSuperadminReply(): Promise<boolean> {
  const session = await requireAdmin();
  const thread = await prisma.supportThread.findUnique({
    where: { sellerId: session.user.id },
    select: { messages: { orderBy: { createdAt: "desc" }, take: 1, select: { sender: true } } },
  });
  return thread?.messages[0]?.sender === "SUPERADMIN";
}
