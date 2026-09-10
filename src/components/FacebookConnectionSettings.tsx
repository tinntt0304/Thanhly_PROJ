"use client";

import { useEffect, useState } from "react";
import {
  getFacebookConnectionStatus,
  selectFacebookPage,
  disconnectFacebookPage,
  resubscribeFacebookWebhook,
  type FacebookConnectionStatus,
} from "@/lib/actions/facebook-inbox";

function ConnectButton() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-neutral-700">
        Bạn sẽ được chuyển sang Facebook để cấp quyền cho ứng dụng — chỉ cấp quyền cho đúng
        fanpage bạn chọn, không ảnh hưởng các trang khác.
      </p>
      {/* Route Handler tự redirect sang Facebook — cần điều hướng cả trang (không phải soft
      navigation của next/link), nên cố ý dùng <a> thường ở đây. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a
        data-tour="settings-connect"
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
    <div className="flex flex-col gap-3">
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

// Quản lý kết nối fanpage Facebook cho Hộp thư Facebook (/admin/hop-thu-facebook) — tách riêng
// ra trang Cài đặt (/admin/cai-dat) vì đây là cấu hình 1 lần, không phải thao tác hàng ngày;
// trang Hộp thư Facebook giờ chỉ còn tập trung vào hội thoại/bình luận thật.
export function FacebookConnectionSettings({
  initialError,
  pendingPages,
}: {
  initialError?: string;
  pendingPages: Array<{ id: string; name: string }>;
}) {
  const [status, setStatus] = useState<FacebookConnectionStatus | null>(null);
  const [showPicker, setShowPicker] = useState(pendingPages.length > 0);
  const [resubscribing, setResubscribing] = useState(false);
  const [resubscribeError, setResubscribeError] = useState<string | null>(null);

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

  // Bước tự đăng ký webhook lúc kết nối có thể đã âm thầm thất bại (thiếu quyền, App chưa
  // bật Webhooks product lúc đó...) — nút này gọi lại và trả lỗi thật, khác lúc OAuth connect.
  async function handleResubscribeWebhook() {
    setResubscribing(true);
    setResubscribeError(null);
    const res = await resubscribeFacebookWebhook();
    setResubscribing(false);
    if (res.error) {
      setResubscribeError(res.error);
      return;
    }
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

  if (!status.connected || !status.pageId) {
    return (
      <div className="flex flex-col gap-3">
        {initialError && <p className="text-sm text-red-600">{initialError}</p>}
        <ConnectButton />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between rounded-lg border border-neutral-200 bg-accent-100/40 px-4 py-2.5">
        <p className="text-sm text-text">
          Đã kết nối fanpage <span className="font-medium">{status.pageName}</span>
        </p>
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- Route Handler tự redirect sang Facebook, cần điều hướng cả trang */}
          <a
            data-tour="settings-switch"
            href="/api/auth/facebook/start"
            className="text-xs font-medium text-accent-600 underline hover:text-accent-700"
          >
            Đổi fanpage
          </a>
          <button
            type="button"
            data-tour="settings-disconnect"
            onClick={handleDisconnect}
            className="text-xs font-medium text-red-600 underline hover:text-red-700"
          >
            Ngắt kết nối
          </button>
        </div>
      </div>

      {status.webhookSubscribed === false && (
        <div className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
          <p>
            ⚠️ Trang chưa đăng ký nhận Webhook — tin nhắn khách gửi trên Facebook sẽ{" "}
            <span className="font-medium">không tự hiện ra</span>, phải bấm &quot;Làm mới&quot; ở
            Hộp thư Facebook mới thấy.
          </p>
          <button
            type="button"
            onClick={handleResubscribeWebhook}
            disabled={resubscribing}
            className="shrink-0 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {resubscribing ? "Đang đăng ký..." : "Đăng ký lại webhook"}
          </button>
        </div>
      )}
      {resubscribeError && <p className="text-sm text-red-600">{resubscribeError}</p>}
    </div>
  );
}
