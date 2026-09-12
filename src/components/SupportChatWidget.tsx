"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { getMySupportThread, sendSupportMessageAsSeller, type SupportMessageDTO } from "@/lib/actions/support";
import { formatDateTime } from "@/lib/auction";
import { useRealtimeBroadcast } from "@/lib/realtime-client";

// Realtime (Supabase Broadcast) là đường đi chính — poll ở đây chỉ còn là lưới an toàn khi
// chưa cấu hình realtime hoặc kết nối realtime bị rớt, cùng tinh thần ChatWidget.tsx.
const POLL_MS = 20000;

// Nhắn tin trực tiếp với (các) superadmin để xin hỗ trợ 1 tính năng nào đó trên trang admin —
// mỗi seller chỉ có đúng 1 thread duy nhất (tự tạo ở lần đầu ghé trang), khác Chat hỗ trợ
// (/admin/chat, chỉ superadmin dùng để trả lời khách vãng lai công khai).
export function SupportChatWidget() {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessageDTO[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const pollRef = useRef<() => void>(() => {});
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const res = await getMySupportThread();
      if (cancelled) return;
      setThreadId(res.threadId);
      setMessages(res.messages);
    }
    pollRef.current = poll;
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
      pollRef.current = () => {};
    };
  }, []);
  const triggerRefresh = useCallback(() => pollRef.current(), []);
  useRealtimeBroadcast(threadId ? `support:${threadId}` : null, "message", triggerRefresh);

  useLayoutEffect(() => {
    const el = messagesContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function handleSend() {
    if (draft.trim() === "" || sending) return;
    setSending(true);
    const content = draft;
    setDraft("");
    const result = await sendSupportMessageAsSeller(content);
    if (result.error) {
      setDraft(content);
    } else {
      pollRef.current();
    }
    setSending(false);
  }

  return (
    <div className="flex h-[600px] flex-col overflow-hidden rounded-lg border border-neutral-200 bg-surface">
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-neutral-500">
            Có thắc mắc hoặc cần hỗ trợ về 1 tính năng nào đó? Nhắn ngay cho quản trị sàn ở đây.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {messages.map((m) => (
              <div key={m.id} className={`flex flex-col ${m.sender === "SELLER" ? "items-end" : "items-start"}`}>
                <div
                  className={`max-w-[75%] rounded-lg px-3 py-1.5 text-sm ${
                    m.sender === "SELLER" ? "bg-accent-500 text-white" : "bg-neutral-100 text-text"
                  }`}
                >
                  {m.content}
                </div>
                <span className="mt-0.5 text-[10px] text-neutral-400">{formatDateTime(new Date(m.createdAt))}</span>
              </div>
            ))}
          </div>
        )}
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
          placeholder="Nhập nội dung cần hỗ trợ..."
          data-tour="support-input"
          className="min-w-0 flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm text-text focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || draft.trim() === ""}
          data-tour="support-send"
          className="rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600 disabled:opacity-50"
        >
          Gửi
        </button>
      </div>
    </div>
  );
}
