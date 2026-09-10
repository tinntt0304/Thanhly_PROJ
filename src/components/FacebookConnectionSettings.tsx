"use client";

import { useEffect, useState } from "react";
import {
  listFacebookPageConnections,
  selectFacebookPage,
  clearPendingFacebookPages,
  disconnectFacebookPage,
  resubscribeFacebookWebhook,
  type FacebookPageConnectionInfo,
} from "@/lib/actions/facebook-inbox";

function ConnectButton({ label }: { label: string }) {
  return (
    // Route Handler tự redirect sang Facebook — cần điều hướng cả trang (không phải soft
    // navigation của next/link), nên cố ý dùng <a> thường ở đây.
    // eslint-disable-next-line @next/next/no-html-link-for-pages
    <a
      data-tour="settings-connect"
      href="/api/auth/facebook/start"
      className="inline-flex w-fit items-center gap-2 rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600"
    >
      {label}
    </a>
  );
}

// Chọn 1 HOẶC NHIỀU fanpage cùng lúc (checkbox) — 1 seller giờ kết nối được nhiều fanpage,
// khác trước đây chỉ chọn được đúng 1 trang duy nhất.
function PagePicker({ pages, onDone }: { pages: Array<{ id: string; name: string }>; onDone: () => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [connecting, setConnecting] = useState(false);
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleConnect() {
    setConnecting(true);
    setError(null);
    const ids = [...selected];
    // Kết nối TUẦN TỰ, không dùng Promise.all — mỗi lượt kết nối gọi Graph API + ghi DB, chạy
    // đồng thời nhiều lượt dễ dính lỗi tranh chấp kết nối DB qua PgBouncer (transaction pooler)
    // và làm 1 trang lỗi kéo mất kết quả của các trang khác đã thành công.
    const nowConnected = new Set(connectedIds);
    const errors: string[] = [];
    for (const id of ids) {
      const res = await selectFacebookPage(id);
      if (res.error) errors.push(`${pages.find((p) => p.id === id)?.name}: ${res.error}`);
      else nowConnected.add(id);
      setConnectedIds(new Set(nowConnected));
    }
    setSelected(new Set());
    setError(errors.length > 0 ? errors.join(" • ") : null);
    setConnecting(false);
  }

  async function handleDone() {
    await clearPendingFacebookPages();
    onDone();
  }

  const remaining = pages.filter((p) => !connectedIds.has(p.id));

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-neutral-700">
        Bạn quản lý nhiều fanpage — tick chọn 1 hoặc nhiều trang muốn kết nối rồi bấm &quot;Kết
        nối&quot;.
      </p>
      <div className="flex flex-col gap-2">
        {remaining.map((p) => (
          <label
            key={p.id}
            className="flex items-center gap-3 rounded-md border border-neutral-200 px-3 py-2 text-sm text-text transition-colors hover:bg-neutral-50"
          >
            <input
              type="checkbox"
              checked={selected.has(p.id)}
              onChange={() => toggle(p.id)}
              disabled={connecting}
              className="h-4 w-4 accent-accent-500"
            />
            {p.name}
          </label>
        ))}
        {connectedIds.size > 0 && (
          <p className="text-xs text-accent-2-700">Đã kết nối {connectedIds.size} trang ở trên.</p>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleConnect}
          disabled={connecting || selected.size === 0}
          className="rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600 disabled:opacity-50"
        >
          {connecting ? "Đang kết nối..." : `Kết nối${selected.size > 0 ? ` (${selected.size})` : ""}`}
        </button>
        <button type="button" onClick={handleDone} className="text-sm font-medium text-accent-600 underline">
          Xong
        </button>
      </div>
    </div>
  );
}

function ConnectionRow({
  connection,
  onChanged,
}: {
  connection: FacebookPageConnectionInfo;
  onChanged: () => void;
}) {
  const [resubscribing, setResubscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDisconnect() {
    if (!window.confirm(`Ngắt kết nối fanpage "${connection.pageName ?? connection.pageId}"?`)) return;
    await disconnectFacebookPage(connection.pageId);
    onChanged();
  }

  async function handleResubscribe() {
    setResubscribing(true);
    setError(null);
    const res = await resubscribeFacebookWebhook(connection.pageId);
    setResubscribing(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    onChanged();
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 px-4 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-text">
          <span className="font-medium">{connection.pageName ?? connection.pageId}</span>
        </p>
        <button
          type="button"
          data-tour="settings-disconnect"
          onClick={handleDisconnect}
          className="shrink-0 text-xs font-medium text-red-600 underline hover:text-red-700"
        >
          Ngắt kết nối
        </button>
      </div>
      {!connection.webhookSubscribed && (
        <div className="flex flex-col gap-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 sm:flex-row sm:items-center sm:justify-between">
          <p>
            ⚠️ Chưa đăng ký nhận Webhook — tin nhắn khách gửi sẽ{" "}
            <span className="font-medium">không tự hiện ra</span>.
          </p>
          <button
            type="button"
            onClick={handleResubscribe}
            disabled={resubscribing}
            className="shrink-0 rounded-md bg-red-600 px-2.5 py-1 font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {resubscribing ? "Đang đăng ký..." : "Đăng ký lại webhook"}
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

// Quản lý kết nối fanpage Facebook cho Hộp thư Facebook (/admin/hop-thu-facebook) — tách riêng
// ra trang Cài đặt (/admin/cai-dat) vì đây là cấu hình không phải thao tác hàng ngày. 1 seller
// kết nối được NHIỀU fanpage cùng lúc (xem FacebookPageConnection ở schema.prisma) — hiện danh
// sách tất cả trang đã kết nối, mỗi trang tự quản lý trạng thái webhook/ngắt kết nối riêng.
export function FacebookConnectionSettings({
  initialError,
  initialInfo,
  fbTotal,
  pendingPages,
}: {
  initialError?: string;
  initialInfo?: string;
  fbTotal?: number;
  pendingPages: Array<{ id: string; name: string }>;
}) {
  const [connections, setConnections] = useState<FacebookPageConnectionInfo[] | null>(null);
  const [showPicker, setShowPicker] = useState(pendingPages.length > 0);

  async function refresh() {
    setConnections(await listFacebookPageConnections());
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setState nằm sau await trong refresh(), không đồng bộ
    refresh();
  }, []);

  if (connections === null) return <p className="text-sm text-neutral-500">Đang tải...</p>;

  // fbTotal = tổng số fanpage Facebook trả về cho tài khoản này (GHI RÕ ra để seller tự đối
  // chiếu với số fanpage thật mình quản lý) — nếu số này ít hơn thực tế, thường do app chưa qua
  // App Review/Business Verification nên Facebook chỉ cấp quyền một phần, KHÔNG phải lỗi ở đây.
  const totalHint =
    fbTotal !== undefined ? (
      <p className="text-xs text-neutral-500">
        Facebook trả về {fbTotal} fanpage bạn quản lý. Thiếu trang nào so với thực tế thì cần vào Meta App
        Dashboard kiểm tra quyền pages_show_list/pages_messaging cho trang đó (thường do app chưa qua App
        Review hoặc trang chưa được thêm vào Business Portfolio của app).
      </p>
    ) : null;

  if (showPicker) {
    return (
      <div className="flex flex-col gap-3">
        {totalHint}
        <PagePicker
          pages={pendingPages}
          onDone={() => {
            setShowPicker(false);
            refresh();
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {initialError && <p className="text-sm text-red-600">{initialError}</p>}
      {initialInfo === "all_connected" && (
        <>
          <p className="text-sm text-neutral-600">Bạn đã kết nối hết các fanpage mình quản lý, không có trang mới để thêm.</p>
          {totalHint}
        </>
      )}

      {connections.length > 0 && (
        <div className="flex flex-col gap-2">
          {connections.map((c) => (
            <ConnectionRow key={c.pageId} connection={c} onChanged={refresh} />
          ))}
        </div>
      )}

      <ConnectButton label={connections.length === 0 ? "Kết nối với Facebook" : "Kết nối thêm fanpage"} />
    </div>
  );
}
