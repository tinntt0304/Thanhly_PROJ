"use client";

import { useEffect, useState } from "react";

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

export function Countdown({ endTime }: { endTime: string }) {
  const target = new Date(endTime).getTime();
  // null ban đầu để khớp giữa server/client (tránh hydration mismatch do Date.now()
  // khác nhau giữa lúc render server và lúc hydrate client); tính lại ngay sau khi mount.
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    setRemaining(target - Date.now());
    const id = setInterval(() => setRemaining(target - Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);

  if (remaining === null) {
    return <span className="text-neutral-400">...</span>;
  }

  return (
    <span className={remaining <= 0 ? "text-neutral-500" : "text-red-600 font-medium"}>
      {formatRemaining(remaining)}
    </span>
  );
}
