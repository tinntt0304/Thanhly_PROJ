"use client";

import { useSyncExternalStore } from "react";

function formatRemaining(ms: number): string {
  if (ms <= 0) return "Đã kết thúc";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days} ngày ${hours} giờ`;
  if (hours > 0) return `${hours} giờ ${minutes} phút`;
  if (minutes > 0) return `${minutes} phút ${seconds} giây`;
  return `${seconds} giây`;
}

function subscribe(callback: () => void) {
  const id = setInterval(callback, 1000);
  return () => clearInterval(id);
}

export function Countdown({ endTime }: { endTime: string }) {
  const target = new Date(endTime).getTime();
  // useSyncExternalStore: getSnapshot chạy lại mỗi giây qua subscribe (tick đồng hồ).
  // getServerSnapshot trả null để khớp với lần render đầu lúc hydrate (tránh mismatch
  // do Date.now() khác nhau giữa server và client), React tự re-render ngay sau khi
  // hydrate xong bằng getSnapshot thật — không cần tự setState trong effect.
  const remaining = useSyncExternalStore(
    subscribe,
    () => target - Date.now(),
    () => null
  );

  if (remaining === null) {
    return <span className="text-neutral-400">...</span>;
  }

  return (
    <span className={remaining <= 0 ? "text-neutral-500" : "text-red-600 font-medium"}>
      {formatRemaining(remaining)}
    </span>
  );
}
