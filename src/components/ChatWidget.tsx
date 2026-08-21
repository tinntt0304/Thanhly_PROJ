"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChatSession,
  getChatMessages,
  getChatSession,
  sendVisitorMessage,
  type ChatMessageDTO,
  type ChatSessionDTO,
} from "@/lib/actions/chat";

const SESSION_KEY = "hifen_chat_session_id";
const SEEN_KEY = "hifen_chat_last_seen";
const POLL_MS = 5000;

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<ChatSessionDTO | null | undefined>(undefined); // undefined = chưa xác định, null = chưa có phiên
  const [messages, setMessages] = useState<ChatMessageDTO[]>([]);
  const [hasUnread, setHasUnread] = useState(false);
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Khôi phục phiên chat đã có từ localStorage khi component mount. Đây là lần đồng bộ
  // hoá một lần duy nhất với hệ thống bên ngoài (localStorage + DB) lúc mount — đúng
  // mục đích effect được sinh ra để làm, nên giữ setState trực tiếp ở đây.
  useEffect(() => {
    const savedId = localStorage.getItem(SESSION_KEY);
    if (!savedId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- không có gì để await, đây là nhánh đồng bộ hợp lệ của việc khởi tạo 1 lần lúc mount
      setSession(null);
      return;
    }
    getChatSession(savedId).then((s) => {
      if (s) {
        setSession(s);
      } else {
        localStorage.removeItem(SESSION_KEY);
        setSession(null);
      }
    });
  }, []);

  // Polling tin nhắn + trạng thái phiên (đóng/mở) khi đã có phiên — dùng session?.id
  // (chuỗi ổn định) làm dependency thay vì cả object session, để việc cập nhật
  // session.status bên trong poll() không làm effect tự khởi động lại liên tục.
  const sessionId = session?.id;
  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;
    async function poll() {
      if (!sessionId) return;
      const [msgs, freshSession] = await Promise.all([
        getChatMessages(sessionId),
        getChatSession(sessionId),
      ]);
      if (cancelled) return;
      setMessages(msgs);
      if (freshSession) setSession(freshSession);

      const lastAdminMsg = [...msgs].reverse().find((m) => m.sender === "ADMIN");
      if (lastAdminMsg) {
        const lastSeen = localStorage.getItem(SEEN_KEY);
        const isUnread = !lastSeen || new Date(lastAdminMsg.createdAt) > new Date(lastSeen);
        setHasUnread(isUnread && !open);
      }
    }

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [sessionId, open]);

  function toggleOpen() {
    setOpen((prev) => {
      const next = !prev;
      if (next) {
        // Đánh dấu đã xem ngay trong handler bấm nút (nguyên nhân gây ra thay đổi),
        // thay vì phản ứng lại qua effect — đúng khuyến nghị của React.
        localStorage.setItem(SEEN_KEY, new Date().toISOString());
        setHasUnread(false);
      }
      return next;
    });
  }

  useEffect(() => {
    if (open) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  async function handleStartChat(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = String(formData.get("name") ?? "");
    const phone = String(formData.get("phone") ?? "");

    const result = await createChatSession(name, phone);
    if (result.error || !result.session) {
      setFormError(result.error ?? "Có lỗi xảy ra.");
      return;
    }
    localStorage.setItem(SESSION_KEY, result.session.id);
    setSession(result.session);
    setFormError(null);
  }

  async function handleSend() {
    if (!session || draft.trim() === "" || sending) return;
    setSending(true);
    const content = draft;
    setDraft("");
    const result = await sendVisitorMessage(session.id, content);
    if (result.error) {
      setDraft(content);
    } else {
      const msgs = await getChatMessages(session.id);
      setMessages(msgs);
    }
    setSending(false);
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="flex h-[480px] w-[340px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-neutral-200 bg-surface shadow-xl">
          <div className="flex items-center justify-between bg-accent-500 px-4 py-3">
            <span className="font-heading text-sm font-bold text-white">Chat với người bán</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Đóng chat"
              className="text-white/90 hover:text-white"
            >
              ×
            </button>
          </div>

          {session === undefined ? (
            <div className="flex flex-1 items-center justify-center text-sm text-neutral-500">
              Đang tải...
            </div>
          ) : session === null ? (
            <form onSubmit={handleStartChat} className="flex flex-1 flex-col gap-3 p-4">
              <p className="text-sm text-neutral-700">
                Để lại tên và SĐT để bắt đầu chat trực tiếp với người bán.
              </p>
              <div className="flex flex-col gap-1">
                <label htmlFor="chat-name" className="text-sm font-medium text-text">
                  Tên
                </label>
                <input
                  id="chat-name"
                  name="name"
                  required
                  className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-text focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="chat-phone" className="text-sm font-medium text-text">
                  Số điện thoại
                </label>
                <input
                  id="chat-phone"
                  name="phone"
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="0901234567"
                  required
                  className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-text focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
                />
              </div>
              {formError && <p className="text-sm text-red-600">{formError}</p>}
              <button
                type="submit"
                className="mt-auto rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600"
              >
                Bắt đầu chat
              </button>
            </form>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-3">
                {messages.length === 0 ? (
                  <p className="p-2 text-center text-sm text-neutral-500">
                    Gửi tin nhắn đầu tiên cho người bán nhé!
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {messages.map((m) => (
                      <div
                        key={m.id}
                        className={`max-w-[80%] rounded-lg px-3 py-1.5 text-sm ${
                          m.sender === "VISITOR"
                            ? "self-end bg-accent-500 text-white"
                            : "self-start bg-neutral-100 text-text"
                        }`}
                      >
                        {m.content}
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>
              {session.status === "CLOSED" ? (
                <p className="border-t border-neutral-200 p-3 text-center text-xs text-neutral-500">
                  Phiên chat này đã đóng.
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
                    placeholder="Nhập tin nhắn..."
                    className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm text-text focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
                  />
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={sending || draft.trim() === ""}
                    className="rounded-md bg-accent-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600 disabled:opacity-50"
                  >
                    Gửi
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={toggleOpen}
        aria-label={open ? "Đóng chat" : "Mở chat"}
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-accent-500 text-2xl text-white shadow-lg transition-colors hover:bg-accent-600"
      >
        {open ? "×" : "💬"}
        {hasUnread && !open && (
          <span className="absolute right-0 top-0 h-3.5 w-3.5 rounded-full border-2 border-surface bg-red-500" />
        )}
      </button>
    </div>
  );
}
