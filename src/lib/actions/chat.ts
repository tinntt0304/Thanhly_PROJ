"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { revalidatePath } from "next/cache";

export type ChatMessageDTO = {
  id: string;
  sender: "VISITOR" | "ADMIN";
  content: string;
  createdAt: string;
};

export type ChatSessionDTO = {
  id: string;
  visitorName: string;
  visitorPhone: string;
  status: "OPEN" | "CLOSED";
};

export type ChatSessionSummaryDTO = ChatSessionDTO & {
  updatedAt: string;
  lastMessage: string | null;
  lastMessageSender: "VISITOR" | "ADMIN" | null;
  messageCount: number;
};

const nameSchema = z.string().trim().min(1, "Vui lòng nhập tên.").max(100);
const phoneSchema = z
  .string()
  .trim()
  .regex(/^0\d{9}$/, "Số điện thoại phải có đúng 10 chữ số.");
const contentSchema = z.string().trim().min(1).max(2000);

export async function createChatSession(
  name: string,
  phone: string
): Promise<{ session?: ChatSessionDTO; error?: string }> {
  const parsedName = nameSchema.safeParse(name);
  if (!parsedName.success) return { error: parsedName.error.issues[0]?.message };
  const parsedPhone = phoneSchema.safeParse(phone);
  if (!parsedPhone.success) return { error: parsedPhone.error.issues[0]?.message };

  const session = await prisma.chatSession.create({
    data: { visitorName: parsedName.data, visitorPhone: parsedPhone.data },
  });

  revalidatePath("/admin/chat");
  return {
    session: {
      id: session.id,
      visitorName: session.visitorName,
      visitorPhone: session.visitorPhone,
      status: session.status,
    },
  };
}

export async function getChatSession(sessionId: string): Promise<ChatSessionDTO | null> {
  const session = await prisma.chatSession.findUnique({ where: { id: sessionId } });
  if (!session) return null;
  return {
    id: session.id,
    visitorName: session.visitorName,
    visitorPhone: session.visitorPhone,
    status: session.status,
  };
}

export async function getChatMessages(sessionId: string): Promise<ChatMessageDTO[]> {
  const messages = await prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
  });
  return messages.map((m) => ({
    id: m.id,
    sender: m.sender,
    content: m.content,
    createdAt: m.createdAt.toISOString(),
  }));
}

// sessionId hoạt động như 1 "vé" — ai có id (lưu ở localStorage phía khách) đều gửi
// được tin nhắn vào đúng phiên đó, không cần đăng nhập, giống tinh thần không-tài-khoản
// của toàn bộ trang (nhất quán với cách trả giá chỉ cần SĐT).
export async function sendVisitorMessage(
  sessionId: string,
  content: string
): Promise<{ error?: string }> {
  const parsed = contentSchema.safeParse(content);
  if (!parsed.success) return { error: "Nội dung tin nhắn không hợp lệ." };

  const session = await prisma.chatSession.findUnique({ where: { id: sessionId } });
  if (!session) return { error: "Không tìm thấy phiên chat." };
  if (session.status === "CLOSED") {
    return { error: "Phiên chat này đã đóng." };
  }

  await prisma.$transaction([
    prisma.chatMessage.create({ data: { sessionId, sender: "VISITOR", content: parsed.data } }),
    prisma.chatSession.update({ where: { id: sessionId }, data: { updatedAt: new Date() } }),
  ]);

  revalidatePath("/admin/chat");
  return {};
}

export async function sendAdminMessage(
  sessionId: string,
  content: string
): Promise<{ error?: string }> {
  await requireAdmin();

  const parsed = contentSchema.safeParse(content);
  if (!parsed.success) return { error: "Nội dung tin nhắn không hợp lệ." };

  const session = await prisma.chatSession.findUnique({ where: { id: sessionId } });
  if (!session) return { error: "Không tìm thấy phiên chat." };

  await prisma.$transaction([
    prisma.chatMessage.create({ data: { sessionId, sender: "ADMIN", content: parsed.data } }),
    prisma.chatSession.update({ where: { id: sessionId }, data: { updatedAt: new Date() } }),
  ]);

  revalidatePath("/admin/chat");
  return {};
}

export async function listChatSessions(): Promise<ChatSessionSummaryDTO[]> {
  await requireAdmin();

  const sessions = await prisma.chatSession.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { messages: true } },
    },
  });

  return sessions.map((s) => ({
    id: s.id,
    visitorName: s.visitorName,
    visitorPhone: s.visitorPhone,
    status: s.status,
    updatedAt: s.updatedAt.toISOString(),
    lastMessage: s.messages[0]?.content ?? null,
    lastMessageSender: s.messages[0]?.sender ?? null,
    messageCount: s._count.messages,
  }));
}

export async function setChatSessionStatus(
  sessionId: string,
  status: "OPEN" | "CLOSED"
): Promise<void> {
  await requireAdmin();
  await prisma.chatSession.update({ where: { id: sessionId }, data: { status } });
  revalidatePath("/admin/chat");
}
