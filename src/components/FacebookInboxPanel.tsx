"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  listFacebookPageConnections,
  listFacebookConversations,
  listFacebookMessages,
  sendFacebookMessage,
  listFacebookComments,
  replyFacebookComment,
  syncFacebookInbox,
  sendFacebookImage,
  type FacebookPageConnectionInfo,
} from "@/lib/actions/facebook-inbox";
import type { FbConversation, FbMessage, FbComment } from "@/lib/facebook-graph";
import { formatDateTime } from "@/lib/auction";
import { useRealtimeBroadcast } from "@/lib/realtime-client";

function Avatar({ url, name, size = 40 }: { url: string | null; name: string | null; size?: number }) {
  if (url) {
    return (
      // Ảnh đại diện lấy trực tiếp từ CDN của Facebook (host động, không khai báo hết được ở
      // next/image remotePatterns) — CSP img-src đã whitelist riêng 2 host CDN này.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name ?? "Người dùng Facebook"}
        referrerPolicy="no-referrer"
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  const initial = (name ?? "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-accent-100 font-medium text-accent-700"
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.4) }}
    >
      {initial}
    </div>
  );
}

// Nhãn dự phòng tự sinh ở server khi tin nhắn chỉ có đính kèm, không có chữ thật đi kèm (xem
// attachmentFallbackLabel ở webhook route + attachmentLabel ở facebook-graph.ts) — nhận diện
// đúng các nhãn này để KHÔNG hiển thị lặp lại chú thích thừa bên dưới ảnh/video đã render.
const ATTACHMENT_FALLBACK_LABELS = new Set([
  "🖼️ Đã gửi hình ảnh",
  "🎬 Đã gửi video",
  "🎤 Đã gửi tin nhắn thoại",
  "📎 Đã gửi tệp đính kèm — mở Facebook để xem",
]);

function MessageAttachment({ type, url }: { type: "IMAGE" | "VIDEO" | "AUDIO" | "FILE" | null; url: string }) {
  if (type === "IMAGE") {
    return (
      // Ảnh lấy trực tiếp từ CDN Facebook (host động) — CSP img-src đã whitelist riêng.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="Ảnh đính kèm" referrerPolicy="no-referrer" className="max-h-64 w-auto rounded-lg object-contain" />
    );
  }
  if (type === "VIDEO") {
    return <video src={url} controls className="max-h-64 w-auto rounded-lg" />;
  }
  if (type === "AUDIO") {
    return <audio src={url} controls className="w-56" />;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block rounded-lg bg-neutral-100 px-3 py-1.5 text-sm text-accent-600 underline"
    >
      📎 Xem tệp đính kèm
    </a>
  );
}

function AttachImageIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
      <rect x="3" y="3" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4">
      <path
        d={collapsed ? "M8 5l5 5-5 5" : "M12 5l-5 5 5 5"}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatShortTime(iso: string): string {
  const date = new Date(iso);
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay
    ? new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(date)
    : new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" }).format(date);
}

// Realtime (Supabase Broadcast, xem useRealtimeBroadcast) là đường đi chính — poll ở đây chỉ
// còn là lưới an toàn khi chưa cấu hình realtime hoặc kết nối bị rớt. Đọc cache DB (không còn
// gọi Graph API trực tiếp mỗi lần, xem facebook-inbox-store.ts) nên rẻ, không cần giữ 5s/15s
// như trước.
const MESSAGES_POLL_MS = 20000;
const CONVERSATIONS_POLL_MS = 20000;

function MessengerTab({ pageId }: { pageId: string }) {
  const [conversations, setConversations] = useState<FbConversation[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<FbMessage[]>([]);
  const [msgError, setMsgError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sendingImage, setSendingImage] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const [syncing, setSyncing] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mở hội thoại nào cũng phải thấy ngay tin nhắn MỚI NHẤT (ở cuối danh sách) — mặc định
  // trình duyệt cuộn khung overflow về đầu (0), người dùng phải tự kéo xuống mới thấy tin mới.
  // useLayoutEffect để nhảy xuống cuối trước khi vẽ khung hình, tránh nhoáng lên vị trí đầu
  // hội thoại rồi mới nhảy xuống.
  useLayoutEffect(() => {
    const el = messagesContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Nút "Làm mới" — đồng bộ lại từ Graph API (phòng webhook rớt sự kiện/tin nhắn phát sinh
  // trước khi kết nối) rồi mới đọc lại cache, khác với poll/realtime bên dưới (chỉ đọc cache,
  // chạy thường xuyên hơn nên phải rẻ, không gọi Graph API mỗi lần).
  async function handleManualSync() {
    setSyncing(true);
    setLoadError(null);
    const res = await syncFacebookInbox(pageId);
    setSyncing(false);
    setLoading(false);
    if (res.error) {
      setLoadError(res.error);
      return;
    }
    setConversations(res.items ?? []);
  }

  // Poll danh sách hội thoại + realtime cùng gọi lại đúng 1 closure qua ref (xem giải thích
  // chi tiết ở ChatWidget.tsx — tránh set nhầm state cũ khi effect đã bị dọn).
  const pollConversationsRef = useRef<() => void>(() => {});
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const res = await listFacebookConversations(pageId);
      if (cancelled) return;
      setLoading(false);
      if (res.error) {
        setLoadError(res.error);
        return;
      }
      setLoadError(null);
      setConversations(res.items ?? []);
    }
    pollConversationsRef.current = poll;
    poll();
    const id = setInterval(poll, CONVERSATIONS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
      pollConversationsRef.current = () => {};
    };
  }, [pageId]);

  function selectConversation(id: string) {
    setSelectedId(id);
  }

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  // Poll tin nhắn của hội thoại đang mở — khách nhắn thêm trong lúc seller đang xem cũng phải
  // tự hiện ra, không cần chọn lại hội thoại hay reload trang.
  const pollMessagesRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (!selectedId) {
      pollMessagesRef.current = () => {};
      return;
    }
    const conversationId = selectedId;
    let cancelled = false;
    async function poll() {
      const res = await listFacebookMessages(pageId, conversationId);
      if (cancelled) return;
      if (res.error) {
        setMsgError(res.error);
        return;
      }
      setMsgError(null);
      setMessages(res.items ?? []);
    }
    pollMessagesRef.current = poll;
    poll();
    const id = setInterval(poll, MESSAGES_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
      pollMessagesRef.current = () => {};
    };
  }, [pageId, selectedId]);

  // 1 kênh Broadcast riêng cho mỗi trang — khách nhắn mới (qua Webhook) hoặc seller vừa gửi
  // (từ chính tab này hay 1 tab admin khác) đều bắn sự kiện vào đây, cập nhật cả danh sách và
  // tin nhắn của hội thoại đang mở (nếu có) cùng lúc.
  const triggerRefresh = useCallback(() => {
    pollConversationsRef.current();
    pollMessagesRef.current();
  }, []);
  useRealtimeBroadcast(`fb:${pageId}`, "message", triggerRefresh);

  const filteredConversations = conversations.filter((c) => {
    const q = search.trim().toLowerCase();
    if (q === "") return true;
    return (c.participantName ?? "").toLowerCase().includes(q) || (c.snippet ?? "").toLowerCase().includes(q);
  });

  // Hiện ngay tin nhắn/ảnh vừa gửi trong lúc chờ Graph API (Send API) + ghi DB — 2 bước đó cộng
  // lại mất vài giây, không hiện ngay thì seller thấy như bị "đứng" cho tới khi xong hết. Tin
  // giả tạm này bị THAY THẾ HOÀN TOÀN bởi listFacebookMessages() thật ngay sau, nên không cần lo
  // trùng hay lệch id với tin thật.
  function appendOptimisticMessage(message: string, attachmentType: FbMessage["attachmentType"], attachmentUrl: string | null) {
    const id = `optimistic-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id, message, fromId: "page", fromName: null, createdAt: new Date().toISOString(), attachmentType, attachmentUrl },
    ]);
    return id;
  }

  // Nút "Gửi" chỉ chặn double-click ngay lúc bấm (draft rỗng lúc đó) — KHÔNG chờ Graph API +
  // ghi DB xong mới bật lại (mất vài giây), vì tin đã hiện ngay ở appendOptimisticMessage rồi,
  // giữ nút disable thêm nữa chỉ làm seller tưởng chưa gửi được, cản việc gõ tin kế tiếp ngay.
  // Gửi lỗi thì báo qua msgError, không cố khôi phục vào ô nhập vì draft có thể đã đổi khác.
  async function handleSend() {
    if (!selected?.participantPsid || draft.trim() === "") return;
    const psid = selected.participantPsid;
    const conversationId = selectedId;
    const text = draft;
    setDraft("");
    const optimisticId = appendOptimisticMessage(text, null, null);
    const res = await sendFacebookMessage(pageId, psid, text);
    if (res.error) {
      setMsgError(res.error);
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
    } else if (conversationId) {
      const msgs = await listFacebookMessages(pageId, conversationId);
      if (msgs.items) setMessages(msgs.items);
    }
  }

  async function handleSendImage(file: File) {
    if (!selected?.participantPsid || sendingImage) return;
    setSendingImage(true);
    setMsgError(null);
    const previewUrl = URL.createObjectURL(file);
    const optimisticId = appendOptimisticMessage("🖼️ Đã gửi hình ảnh", "IMAGE", previewUrl);
    const formData = new FormData();
    formData.append("image", file);
    const res = await sendFacebookImage(pageId, selected.participantPsid, formData);
    if (res.error) {
      setMsgError(res.error);
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
    } else if (selectedId) {
      const msgs = await listFacebookMessages(pageId, selectedId);
      if (msgs.items) setMessages(msgs.items);
    }
    URL.revokeObjectURL(previewUrl);
    setSendingImage(false);
  }

  // Trên di động không đủ chỗ cho 2 cột list+chat cạnh nhau như desktop — dùng kiểu
  // "master-detail": chưa chọn hội thoại thì hiện danh sách full màn hình, chọn rồi thì ẩn
  // danh sách, hiện khung chat full màn hình kèm nút quay lại (chỉ desktop sm+ mới hiện cả 2
  // cột cùng lúc như trước).
  const listPanelDisplay = selected ? "hidden sm:flex" : "flex";
  const chatPanelDisplay = selected ? "flex" : "hidden sm:flex";

  return (
    <div className="flex h-[70vh] flex-col overflow-hidden rounded-lg border border-neutral-200 bg-surface sm:h-[600px] sm:flex-row">
      <div
        className={`${listPanelDisplay} shrink-0 flex-col overflow-y-auto border-neutral-200 border-b sm:border-b-0 sm:border-r transition-[width] duration-150 ${
          collapsed ? "w-16" : "w-full sm:w-80"
        }`}
      >
        <div className="flex items-center gap-2 border-b border-neutral-100 px-3 py-2">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? "Mở rộng danh sách hội thoại" : "Thu gọn danh sách hội thoại"}
            className={`hidden h-7 shrink-0 items-center justify-center gap-1 rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 sm:flex ${
              collapsed ? "w-7" : "px-1.5"
            }`}
          >
            <CollapseIcon collapsed={collapsed} />
            {!collapsed && <span className="text-xs font-medium">Thu gọn</span>}
          </button>
          {!collapsed && (
            <>
              <span className="flex-1 truncate text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Hội thoại
              </span>
              <button
                type="button"
                onClick={handleManualSync}
                disabled={syncing}
                className="shrink-0 text-xs text-accent-600 underline disabled:opacity-50"
              >
                {syncing ? "Đang đồng bộ..." : "Làm mới"}
              </button>
            </>
          )}
        </div>
        {!collapsed && (
          <div className="border-b border-neutral-100 px-3 py-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm hội thoại..."
              className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm text-text focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
            />
          </div>
        )}
        {loading ? (
          !collapsed && <p className="p-4 text-sm text-neutral-500">Đang tải...</p>
        ) : loadError ? (
          !collapsed && <p className="p-4 text-sm text-red-600">{loadError}</p>
        ) : filteredConversations.length === 0 ? (
          !collapsed && <p className="p-4 text-sm text-neutral-500">Chưa có hội thoại nào.</p>
        ) : (
          filteredConversations.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => selectConversation(c.id)}
              title={c.participantName ?? "Người dùng Facebook"}
              className={`flex items-center gap-2.5 border-b border-neutral-100 px-3 py-2.5 text-left transition-colors hover:bg-neutral-50 ${
                selectedId === c.id ? "bg-accent-100/50" : ""
              } ${collapsed ? "justify-center" : ""}`}
            >
              <Avatar url={c.avatarUrl} name={c.participantName} size={collapsed ? 32 : 40} />
              {!collapsed && (
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-text">
                      {c.participantName ?? "Người dùng Facebook"}
                    </span>
                    <span className="shrink-0 text-[11px] text-neutral-400">{formatShortTime(c.updatedAt)}</span>
                  </div>
                  {c.snippet && <span className="truncate text-xs text-neutral-500">{c.snippet}</span>}
                </div>
              )}
            </button>
          ))
        )}
      </div>

      <div className={`${chatPanelDisplay} min-w-0 flex-1 flex-col`}>
        {!selected ? (
          <div className="flex flex-1 items-center justify-center text-sm text-neutral-500">
            Chọn 1 hội thoại để xem tin nhắn.
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2.5 border-b border-neutral-200 px-4 py-3">
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                title="Quay lại danh sách hội thoại"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 sm:hidden"
              >
                <CollapseIcon collapsed={false} />
              </button>
              <Avatar url={selected.avatarUrl} name={selected.participantName} size={32} />
              <p className="text-sm font-medium text-text">{selected.participantName ?? "Người dùng Facebook"}</p>
            </div>
            <div ref={messagesContainerRef} className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4">
              {msgError && <p className="mb-2 text-sm text-red-600">{msgError}</p>}
              {/* min-h-full + justify-end: hội thoại ít tin nhắn dồn về SÁT khung nhập liệu
              (giống Messenger/Zalo thật), khoảng trắng dư ra nằm ở TRÊN chứ không phải khoảng
              trống to đùng ngay phía trên nút Gửi. */}
              <div className="flex min-h-full min-w-0 flex-col justify-end gap-2">
                {messages.map((m) => {
                  const isFromPage = !!(m.fromId && m.fromId !== selected.participantPsid);
                  const hasRealCaption = !ATTACHMENT_FALLBACK_LABELS.has(m.message);
                  return (
                    <div key={m.id} className={`flex min-w-0 flex-col ${isFromPage ? "items-end" : "items-start"}`}>
                      {m.attachmentUrl ? (
                        <div className="flex max-w-[75%] min-w-0 flex-col gap-1">
                          <MessageAttachment type={m.attachmentType} url={m.attachmentUrl} />
                          {hasRealCaption && (
                            <div
                              className={`min-w-0 break-words rounded-lg px-3 py-1.5 text-sm ${
                                isFromPage ? "self-end bg-accent-500 text-white" : "self-start bg-neutral-100 text-text"
                              }`}
                            >
                              {m.message}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div
                          // break-words: tin nhắn dạng URL/mã dài không có khoảng trắng (không
                          // có điểm ngắt dòng tự nhiên) sẽ đội bong bóng chat rộng ra, đẩy cả
                          // khung hội thoại tràn ngang phải cuộn ngang mới xem hết — bắt buộc
                          // ngắt dòng dù giữa từ để luôn nằm gọn trong max-w-[75%].
                          className={`max-w-[75%] min-w-0 break-words rounded-lg px-3 py-1.5 text-sm ${
                            isFromPage ? "bg-accent-500 text-white" : "bg-neutral-100 text-text"
                          }`}
                        >
                          {m.message}
                        </div>
                      )}
                      <span className="mt-0.5 text-[10px] text-neutral-400">{formatDateTime(new Date(m.createdAt))}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-2 border-t border-neutral-200 p-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = ""; // cho phép chọn lại đúng file này ở lần sau
                  if (file) handleSendImage(file);
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={sendingImage || !selected.participantPsid}
                title="Gửi ảnh"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 disabled:opacity-50"
              >
                <AttachImageIcon />
              </button>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={
                  sendingImage
                    ? "Đang gửi ảnh..."
                    : "Nhập phản hồi... (chỉ gửi được trong vòng 24h kể từ tin nhắn cuối của khách)"
                }
                disabled={sendingImage}
                className="min-w-0 flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm text-text focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={draft.trim() === "" || !selected.participantPsid}
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

function CommentsTab({ pageId }: { pageId: string }) {
  const [comments, setComments] = useState<FbComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [repliedIds, setRepliedIds] = useState<Set<string>>(new Set());

  async function loadComments() {
    setLoading(true);
    setLoadError(null);
    const res = await listFacebookComments(pageId);
    setLoading(false);
    if (res.error) {
      setLoadError(res.error);
      return;
    }
    setComments(res.items ?? []);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setState nằm sau await trong loadComments(), không đồng bộ
    loadComments();
    // pageId không đổi trong 1 lần mount — FacebookInboxPanel dùng key={pageId} để tự remount
    // hẳn component này mỗi khi đổi tab fanpage, nên [] (chạy 1 lần lúc mount) là đủ đúng.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleReply(commentId: string) {
    const text = (replyDrafts[commentId] ?? "").trim();
    if (text === "" || replyingId) return;
    setReplyingId(commentId);
    setReplyError(null);
    const res = await replyFacebookComment(pageId, commentId, text);
    setReplyingId(null);
    if (res.error) {
      setReplyError(res.error);
      return;
    }
    setRepliedIds((prev) => new Set(prev).add(commentId));
    setReplyDrafts((prev) => ({ ...prev, [commentId]: "" }));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Bình luận gần đây (20 bài đăng mới nhất)
        </span>
        <button type="button" onClick={loadComments} className="text-xs text-accent-600 underline">
          Làm mới
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-neutral-500">Đang tải...</p>
      ) : loadError ? (
        <p className="text-sm text-red-600">{loadError}</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-neutral-500">Chưa có bình luận nào.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {comments.map((c) => (
            <div key={c.id} className="rounded-lg border border-neutral-200 p-3">
              <div className="flex items-start gap-2.5">
                <Avatar url={c.avatarUrl} name={c.fromName} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-text">{c.fromName ?? "Người dùng Facebook"}</span>
                    <span className="shrink-0 text-xs text-neutral-400">{formatDateTime(new Date(c.createdAt))}</span>
                  </div>
                  {c.postMessage && <p className="mt-0.5 truncate text-xs text-neutral-500">Bài đăng: {c.postMessage}</p>}
                  <p className="mt-1 break-words text-sm text-text">{c.message}</p>
                </div>
              </div>

              {repliedIds.has(c.id) ? (
                <p className="mt-2 text-xs text-accent-2-700">Đã trả lời.</p>
              ) : (
                <div className="mt-2 flex gap-2">
                  <input
                    value={replyDrafts[c.id] ?? ""}
                    onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [c.id]: e.target.value }))}
                    placeholder="Trả lời bình luận..."
                    className="flex-1 rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm text-text focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleReply(c.id)}
                    disabled={replyingId === c.id}
                    className="rounded-md bg-accent-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-600 disabled:opacity-50"
                  >
                    Trả lời
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {replyError && <p className="text-sm text-red-600">{replyError}</p>}
    </div>
  );
}

// Cấu hình kết nối fanpage (connect/đổi/ngắt kết nối) sống ở /admin/cai-dat
// (FacebookConnectionSettings.tsx) — component này giờ chỉ còn hiển thị hội thoại/bình luận
// của các fanpage đã kết nối, đơn giản hơn để tập trung đúng việc "dùng hàng ngày".
//
// 1 seller có thể kết nối NHIỀU fanpage — khi đó hiện thêm 1 dải tab chọn đúng fanpage đang
// xem (giống Messenger thật khi quản lý nhiều Page), mỗi fanpage có hội thoại/bình luận HOÀN
// TOÀN riêng, không gộp chung 1 danh sách.
export function FacebookInboxPanel() {
  const [connections, setConnections] = useState<FacebookPageConnectionInfo[] | null>(null);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [tab, setTab] = useState<"messenger" | "comments">("messenger");

  useEffect(() => {
    listFacebookPageConnections().then((list) => {
      setConnections(list);
      setActivePageId((prev) => prev ?? list[0]?.pageId ?? null);
    });
  }, []);

  if (!connections) return <p className="text-sm text-neutral-500">Đang tải...</p>;

  if (connections.length === 0) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4">
        <p className="text-sm text-neutral-700">Chưa kết nối fanpage nào.</p>
        <Link
          href="/admin/cai-dat"
          className="inline-flex w-fit items-center gap-2 rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600"
        >
          Vào Cài đặt để kết nối
        </Link>
      </div>
    );
  }

  const active = connections.find((c) => c.pageId === activePageId) ?? connections[0];

  return (
    <div className="flex flex-col gap-4">
      {connections.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {connections.map((c) => (
            <button
              key={c.pageId}
              type="button"
              onClick={() => setActivePageId(c.pageId)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                active.pageId === c.pageId
                  ? "bg-accent-500 text-white"
                  : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
              }`}
            >
              {c.pageName ?? c.pageId}
            </button>
          ))}
        </div>
      )}

      {!active.webhookSubscribed && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
          <p>
            ⚠️ Trang <span className="font-medium">{active.pageName ?? active.pageId}</span> chưa đăng ký nhận
            Webhook — tin nhắn khách gửi sẽ <span className="font-medium">không tự hiện ra</span>, phải bấm
            &quot;Làm mới&quot; mới thấy.
          </p>
          <Link href="/admin/cai-dat" className="shrink-0 text-xs font-medium text-red-700 underline">
            Sửa ở Cài đặt →
          </Link>
        </div>
      )}

      <div className="flex gap-1 border-b border-neutral-200">
        <button
          type="button"
          onClick={() => setTab("messenger")}
          className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
            tab === "messenger" ? "border-accent-500 text-accent-600" : "border-transparent text-neutral-600 hover:text-text"
          }`}
        >
          Tin nhắn Messenger
        </button>
        <button
          type="button"
          onClick={() => setTab("comments")}
          className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
            tab === "comments" ? "border-accent-500 text-accent-600" : "border-transparent text-neutral-600 hover:text-text"
          }`}
        >
          Bình luận
        </button>
      </div>

      {/* key={active.pageId}: đổi tab fanpage thì tạo lại component từ đầu, tránh lẫn state
      (hội thoại đang chọn, ô tìm kiếm...) của fanpage cũ sang fanpage mới. */}
      {tab === "messenger" ? (
        <MessengerTab key={active.pageId} pageId={active.pageId} />
      ) : (
        <CommentsTab key={active.pageId} pageId={active.pageId} />
      )}
    </div>
  );
}
