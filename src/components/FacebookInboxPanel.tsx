"use client";

import { useEffect, useState } from "react";
import {
  getFacebookConnectionStatus,
  selectFacebookPage,
  disconnectFacebookPage,
  listFacebookConversations,
  listFacebookMessages,
  sendFacebookMessage,
  listFacebookComments,
  replyFacebookComment,
  type FacebookConnectionStatus,
} from "@/lib/actions/facebook-inbox";
import type { FbConversation, FbMessage, FbComment } from "@/lib/facebook-graph";
import { formatDateTime } from "@/lib/auction";

function ConnectButton() {
  return (
    <div className="flex max-w-lg flex-col gap-3 rounded-lg border border-neutral-200 p-4">
      <p className="text-sm text-neutral-700">
        Kết nối fanpage của bạn để xem và trả lời tin nhắn Messenger + bình luận ngay tại đây.
        Bạn sẽ được chuyển sang Facebook để cấp quyền cho ứng dụng — chỉ cấp quyền cho đúng
        fanpage bạn chọn, không ảnh hưởng các trang khác.
      </p>
      {/* Route Handler tự redirect sang Facebook — cần điều hướng cả trang (không phải soft
      navigation của next/link), nên cố ý dùng <a> thường ở đây. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a
        href="/api/auth/facebook/start"
        className="inline-flex w-fit items-center gap-2 rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600"
      >
        Kết nối với Facebook
      </a>
    </div>
  );
}

function PagePicker({ pages, onSelected }: { pages: Array<{ id: string; name: string }>; onSelected: () => void }) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(pageId: string) {
    setPending(pageId);
    setError(null);
    const res = await selectFacebookPage(pageId);
    setPending(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    onSelected();
  }

  return (
    <div className="flex max-w-lg flex-col gap-3 rounded-lg border border-neutral-200 p-4">
      <p className="text-sm text-neutral-700">Bạn quản lý nhiều fanpage — chọn 1 trang để kết nối:</p>
      <div className="flex flex-col gap-2">
        {pages.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => handleSelect(p.id)}
            disabled={pending !== null}
            className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2 text-sm text-text transition-colors hover:bg-neutral-50 disabled:opacity-50"
          >
            {p.name}
            <span className="text-xs text-accent-600">{pending === p.id ? "Đang kết nối..." : "Chọn"}</span>
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

function MessengerTab() {
  const [conversations, setConversations] = useState<FbConversation[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<FbMessage[]>([]);
  const [msgError, setMsgError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  async function loadConversations() {
    setLoading(true);
    setLoadError(null);
    const res = await listFacebookConversations();
    setLoading(false);
    if (res.error) {
      setLoadError(res.error);
      return;
    }
    setConversations(res.items ?? []);
  }

  // Tải danh sách hội thoại 1 lần lúc mount — đồng bộ hoá với hệ thống bên ngoài (Graph API),
  // setState thật sự nằm sau await bên trong loadConversations(), không đồng bộ trong effect.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setState nằm sau await trong loadConversations(), không đồng bộ
    loadConversations();
  }, []);

  async function selectConversation(id: string) {
    setSelectedId(id);
    setMsgError(null);
    const res = await listFacebookMessages(id);
    if (res.error) {
      setMsgError(res.error);
      setMessages([]);
      return;
    }
    setMessages(res.items ?? []);
  }

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  async function handleSend() {
    if (!selected?.participantPsid || draft.trim() === "" || sending) return;
    setSending(true);
    const text = draft;
    setDraft("");
    const res = await sendFacebookMessage(selected.participantPsid, text);
    if (res.error) {
      setMsgError(res.error);
      setDraft(text);
    } else if (selectedId) {
      const msgs = await listFacebookMessages(selectedId);
      if (msgs.items) setMessages(msgs.items);
    }
    setSending(false);
  }

  return (
    <div className="flex h-[600px] overflow-hidden rounded-lg border border-neutral-200 bg-surface">
      <div className="flex w-72 shrink-0 flex-col overflow-y-auto border-r border-neutral-200">
        <div className="flex items-center justify-between border-b border-neutral-100 px-3 py-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Hội thoại</span>
          <button type="button" onClick={loadConversations} className="text-xs text-accent-600 underline">
            Làm mới
          </button>
        </div>
        {loading ? (
          <p className="p-4 text-sm text-neutral-500">Đang tải...</p>
        ) : loadError ? (
          <p className="p-4 text-sm text-red-600">{loadError}</p>
        ) : conversations.length === 0 ? (
          <p className="p-4 text-sm text-neutral-500">Chưa có hội thoại nào.</p>
        ) : (
          conversations.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => selectConversation(c.id)}
              className={`flex flex-col gap-0.5 border-b border-neutral-100 px-3 py-2.5 text-left transition-colors hover:bg-neutral-50 ${
                selectedId === c.id ? "bg-accent-100/50" : ""
              }`}
            >
              <span className="truncate text-sm font-medium text-text">{c.participantName ?? "Người dùng Facebook"}</span>
              {c.snippet && <span className="truncate text-xs text-neutral-500">{c.snippet}</span>}
            </button>
          ))
        )}
      </div>

      <div className="flex flex-1 flex-col">
        {!selected ? (
          <div className="flex flex-1 items-center justify-center text-sm text-neutral-500">
            Chọn 1 hội thoại để xem tin nhắn.
          </div>
        ) : (
          <>
            <div className="border-b border-neutral-200 px-4 py-3">
              <p className="text-sm font-medium text-text">{selected.participantName ?? "Người dùng Facebook"}</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {msgError && <p className="mb-2 text-sm text-red-600">{msgError}</p>}
              <div className="flex flex-col gap-2">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${m.fromId && m.fromId !== selected.participantPsid ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-lg px-3 py-1.5 text-sm ${
                        m.fromId && m.fromId !== selected.participantPsid
                          ? "bg-accent-500 text-white"
                          : "bg-neutral-100 text-text"
                      }`}
                    >
                      {m.message}
                    </div>
                    <span className="mt-0.5 text-[10px] text-neutral-400">{formatDateTime(new Date(m.createdAt))}</span>
                  </div>
                ))}
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
                placeholder="Nhập phản hồi... (chỉ gửi được trong vòng 24h kể từ tin nhắn cuối của khách)"
                className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm text-text focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || draft.trim() === "" || !selected.participantPsid}
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

function CommentsTab() {
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
    const res = await listFacebookComments();
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
  }, []);

  async function handleReply(commentId: string) {
    const text = (replyDrafts[commentId] ?? "").trim();
    if (text === "" || replyingId) return;
    setReplyingId(commentId);
    setReplyError(null);
    const res = await replyFacebookComment(commentId, text);
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
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-text">{c.fromName ?? "Người dùng Facebook"}</span>
                <span className="text-xs text-neutral-400">{formatDateTime(new Date(c.createdAt))}</span>
              </div>
              {c.postMessage && <p className="mt-0.5 truncate text-xs text-neutral-500">Bài đăng: {c.postMessage}</p>}
              <p className="mt-1 text-sm text-text">{c.message}</p>

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

export function FacebookInboxPanel({
  initialError,
  pendingPages,
}: {
  initialError?: string;
  pendingPages: Array<{ id: string; name: string }>;
}) {
  const [status, setStatus] = useState<FacebookConnectionStatus | null>(null);
  const [tab, setTab] = useState<"messenger" | "comments">("messenger");
  const [showPicker, setShowPicker] = useState(pendingPages.length > 0);

  async function refreshStatus() {
    setStatus(await getFacebookConnectionStatus());
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setState nằm sau await trong refreshStatus(), không đồng bộ
    refreshStatus();
  }, []);

  async function handleDisconnect() {
    if (!window.confirm("Ngắt kết nối fanpage này?")) return;
    await disconnectFacebookPage();
    await refreshStatus();
  }

  if (!status) return <p className="text-sm text-neutral-500">Đang tải...</p>;

  if (showPicker) {
    return (
      <PagePicker
        pages={pendingPages}
        onSelected={() => {
          setShowPicker(false);
          refreshStatus();
        }}
      />
    );
  }

  if (!status.connected) {
    return (
      <div className="flex flex-col gap-3">
        {initialError && <p className="max-w-lg text-sm text-red-600">{initialError}</p>}
        <ConnectButton />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between rounded-lg border border-neutral-200 bg-accent-100/40 px-4 py-2.5">
        <p className="text-sm text-text">
          Đã kết nối fanpage <span className="font-medium">{status.pageName}</span>
        </p>
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- Route Handler tự redirect sang Facebook, cần điều hướng cả trang */}
          <a href="/api/auth/facebook/start" className="text-xs font-medium text-accent-600 underline hover:text-accent-700">
            Đổi fanpage
          </a>
          <button
            type="button"
            onClick={handleDisconnect}
            className="text-xs font-medium text-red-600 underline hover:text-red-700"
          >
            Ngắt kết nối
          </button>
        </div>
      </div>

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

      {tab === "messenger" ? <MessengerTab /> : <CommentsTab />}
    </div>
  );
}
