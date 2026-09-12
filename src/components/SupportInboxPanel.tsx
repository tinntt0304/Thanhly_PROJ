"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getSupportThreadMessages,
  listSupportThreads,
  sendSupportMessageAsSuperadmin,
  type SupportMessageDTO,
  type SupportThreadSummaryDTO,
} from "@/lib/actions/support";
import { formatDateTime } from "@/lib/auction";
import { useRealtimeBroadcast } from "@/lib/realtime-client";

// Realtime (Supabase Broadcast) là đường đi chính — poll ở đây chỉ còn là lưới an toàn, cùng
// tinh thần AdminChatPanel.tsx.
const POLL_MS = 20000;

// Hộp thư superadmin xem/trả lời tất cả yêu cầu hỗ trợ từ seller (mỗi seller 1 thread duy
// nhất) — cấu trúc danh sách + chi tiết y hệt AdminChatPanel.tsx (chat với khách vãng lai),
// khác ở chỗ đây là seller ĐÃ có tài khoản nên hiện tên/email thay vì tên/SĐT tự nhập.
export function SupportInboxPanel() {
  const [threads, setThreads] = useState<SupportThreadSummaryDTO[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessageDTO[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const pollThreadsRef = useRef<() => void>(() => {});
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const list = await listSupportThreads();
      if (cancelled) return;
      setThreads(list);
    }
    pollThreadsRef.current = poll;
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
      pollThreadsRef.current = () => {};
    };
  }, []);
  const triggerThreadsRefresh = useCallback(() => pollThreadsRef.current(), []);
  useRealtimeBroadcast("support-threads", "updated", triggerThreadsRefresh);

  const pollMessagesRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (!selectedId) {
      pollMessagesRef.current = () => {};
      return;
    }
    const threadId = selectedId;
    let cancelled = false;
    async function poll() {
      const msgs = await getSupportThreadMessages(threadId);
      if (cancelled) return;
      setMessages(msgs);
    }
    pollMessagesRef.current = poll;
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
      pollMessagesRef.current = () => {};
    };
  }, [selectedId]);
  const triggerMessagesRefresh = useCallback(() => pollMessagesRef.current(), []);
  useRealtimeBroadcast(selectedId ? `support:${selectedId}` : null, "message", triggerMessagesRefresh);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const selectedThread = threads.find((t) => t.id === selectedId) ?? null;

  async function handleSend() {
    if (!selectedId || draft.trim() === "" || sending) return;
    setSending(true);
    const content = draft;
    setDraft("");
    const result = await sendSupportMessageAsSuperadmin(selectedId, content);
    if (result.error) {
      setDraft(content);
    } else {
      const [msgs, list] = await Promise.all([getSupportThreadMessages(selectedId), listSupportThreads()]);
      setMessages(msgs);
      setThreads(list);
    }
    setSending(false);
  }

  return (
    <div className="flex h-[600px] overflow-hidden rounded-lg border border-neutral-200 bg-surface">
      <div className="flex w-72 shrink-0 flex-col overflow-y-auto border-r border-neutral-200">
        {threads.length === 0 ? (
          <p className="p-4 text-sm text-neutral-500">Chưa có yêu cầu hỗ trợ nào.</p>
        ) : (
          threads.map((t) => {
            const awaitingReply = t.lastMessageSender === "SELLER";
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedId(t.id)}
                className={`flex flex-col gap-0.5 border-b border-neutral-100 px-3 py-2.5 text-left transition-colors hover:bg-neutral-50 ${
                  selectedId === t.id ? "bg-accent-100/50" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-text">{t.sellerName}</span>
                  {awaitingReply && (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-accent-500" aria-label="Chờ phản hồi" />
                  )}
                </div>
                <span className="truncate text-xs text-neutral-500">{t.sellerEmail}</span>
                {t.lastMessage && (
                  <span className="truncate text-xs text-neutral-500">
                    {t.lastMessageSender === "SUPERADMIN" ? "Bạn: " : ""}
                    {t.lastMessage}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>

      <div className="flex flex-1 flex-col">
        {!selectedThread ? (
          <div className="flex flex-1 items-center justify-center text-sm text-neutral-500">
            Chọn 1 người bán để xem yêu cầu hỗ trợ.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-text">{selectedThread.sellerName}</p>
                <p className="text-xs text-neutral-500">{selectedThread.sellerEmail}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex flex-col gap-2">
                {messages.map((m) => (
                  <div key={m.id} className={`flex flex-col ${m.sender === "SUPERADMIN" ? "items-end" : "items-start"}`}>
                    <div
                      className={`max-w-[75%] rounded-lg px-3 py-1.5 text-sm ${
                        m.sender === "SUPERADMIN" ? "bg-accent-500 text-white" : "bg-neutral-100 text-text"
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
          </>
        )}
      </div>
    </div>
  );
}
