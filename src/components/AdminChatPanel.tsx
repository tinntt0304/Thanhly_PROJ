"use client";

import { useEffect, useRef, useState } from "react";
import {
  getChatMessages,
  listChatSessions,
  sendAdminMessage,
  setChatSessionStatus,
  type ChatMessageDTO,
  type ChatSessionSummaryDTO,
} from "@/lib/actions/chat";
import { formatDateTime } from "@/lib/auction";

const POLL_MS = 5000;

export function AdminChatPanel() {
  const [sessions, setSessions] = useState<ChatSessionSummaryDTO[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageDTO[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Poll danh sách phiên chat
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const list = await listChatSessions();
      if (cancelled) return;
      setSessions(list);
    }
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Poll tin nhắn của phiên đang chọn. Chưa chọn phiên nào thì không cần làm gì —
  // `messages` đã khởi tạo sẵn là [] nên không phải tự reset lại ở đây.
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    async function poll() {
      if (!selectedId) return;
      const msgs = await getChatMessages(selectedId);
      if (cancelled) return;
      setMessages(msgs);
    }
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [selectedId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const selectedSession = sessions.find((s) => s.id === selectedId) ?? null;

  async function handleSend() {
    if (!selectedId || draft.trim() === "" || sending) return;
    setSending(true);
    const content = draft;
    setDraft("");
    const result = await sendAdminMessage(selectedId, content);
    if (result.error) {
      setDraft(content);
    } else {
      const [msgs, list] = await Promise.all([getChatMessages(selectedId), listChatSessions()]);
      setMessages(msgs);
      setSessions(list);
    }
    setSending(false);
  }

  async function toggleStatus() {
    if (!selectedSession) return;
    const next = selectedSession.status === "OPEN" ? "CLOSED" : "OPEN";
    await setChatSessionStatus(selectedSession.id, next);
    setSessions(await listChatSessions());
  }

  return (
    <div className="flex h-[600px] overflow-hidden rounded-lg border border-neutral-200 bg-surface">
      <div className="flex w-72 shrink-0 flex-col overflow-y-auto border-r border-neutral-200">
        {sessions.length === 0 ? (
          <p className="p-4 text-sm text-neutral-500">Chưa có cuộc chat nào.</p>
        ) : (
          sessions.map((s) => {
            const awaitingReply = s.lastMessageSender === "VISITOR";
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedId(s.id)}
                className={`flex flex-col gap-0.5 border-b border-neutral-100 px-3 py-2.5 text-left transition-colors hover:bg-neutral-50 ${
                  selectedId === s.id ? "bg-accent-100/50" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-text">{s.visitorName}</span>
                  {awaitingReply && (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-accent-500" aria-label="Chờ phản hồi" />
                  )}
                </div>
                <span className="text-xs text-neutral-500">{s.visitorPhone}</span>
                {s.lastMessage && (
                  <span className="truncate text-xs text-neutral-500">
                    {s.lastMessageSender === "ADMIN" ? "Bạn: " : ""}
                    {s.lastMessage}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>

      <div className="flex flex-1 flex-col">
        {!selectedSession ? (
          <div className="flex flex-1 items-center justify-center text-sm text-neutral-500">
            Chọn 1 cuộc chat để xem tin nhắn.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-text">{selectedSession.visitorName}</p>
                <p className="text-xs text-neutral-500">{selectedSession.visitorPhone}</p>
              </div>
              <button
                type="button"
                onClick={toggleStatus}
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
              >
                {selectedSession.status === "OPEN" ? "Đóng phiên chat" : "Mở lại"}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex flex-col gap-2">
                {messages.map((m) => (
                  <div key={m.id} className={`flex flex-col ${m.sender === "ADMIN" ? "items-end" : "items-start"}`}>
                    <div
                      className={`max-w-[75%] rounded-lg px-3 py-1.5 text-sm ${
                        m.sender === "ADMIN" ? "bg-accent-500 text-white" : "bg-neutral-100 text-text"
                      }`}
                    >
                      {m.content}
                    </div>
                    <span className="mt-0.5 text-[10px] text-neutral-400">
                      {formatDateTime(new Date(m.createdAt))}
                    </span>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {selectedSession.status === "CLOSED" ? (
              <p className="border-t border-neutral-200 p-3 text-center text-xs text-neutral-500">
                Phiên chat đã đóng — bấm &ldquo;Mở lại&rdquo; để tiếp tục nhắn.
              </p>
            ) : (
              <div className="flex gap-2 border-t border-neutral-200 p-3">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Nhập phản hồi..."
                  className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm text-text focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={sending || draft.trim() === ""}
                  className="rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600 disabled:opacity-50"
                >
                  Gửi
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
