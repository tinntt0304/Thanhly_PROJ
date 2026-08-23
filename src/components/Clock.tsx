"use client";

import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  const id = setInterval(callback, 1000);
  return () => clearInterval(id);
}

function format(date: Date): { time: string; date: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,
    date: `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`,
  };
}

export function Clock({ className }: { className?: string }) {
  // Giống Countdown.tsx: getServerSnapshot trả null để khớp lần render đầu lúc hydrate
  // (tránh mismatch do giờ server khác giờ client), tick lại mỗi giây qua subscribe.
  const now = useSyncExternalStore(
    subscribe,
    () => Date.now(),
    () => null
  );

  if (now === null) {
    return <div className={className}>&nbsp;</div>;
  }

  const { time, date } = format(new Date(now));

  return (
    <div className={className}>
      <div className="font-heading text-sm font-bold leading-none">{time}</div>
      <div className="mt-1 text-xs leading-none opacity-80">{date}</div>
    </div>
  );
}
