"use client";

import { useEffect, useRef, useState } from "react";
import type { ClipboardEvent, KeyboardEvent } from "react";

export const OTP_LENGTH = 6;
// Khớp với server (checkRateLimit "otp-issue-email", 3 lần/600s ở lib/actions/auth.ts) —
// đếm ngược này chỉ là UX (chặn bấm liên tục làm phiền người dùng), giới hạn thật vẫn nằm
// ở server, không phải ở đây.
export const RESEND_COOLDOWN_SECONDS = 120;

export function formatCooldown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// 1 khoảng đếm ngược dùng chung cho mọi màn hình có nút "Gửi lại mã" (xác minh đăng ký,
// quên mật khẩu) — chạy suốt vòng đời component, reset() gọi trực tiếp lúc BẤM nút gửi lại
// (không đợi effect phản ứng theo kết quả server) để tránh setState đồng bộ trong effect
// (react-hooks/set-state-in-effect); chặn spam-click là mục đích chính nên đặt lại ngay lúc
// bấm (kể cả khi server sau đó từ chối do rate-limit) vẫn đúng tinh thần.
export function useResendCooldown(initialSeconds: number = RESEND_COOLDOWN_SECONDS) {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  return [seconds, () => setSeconds(initialSeconds)] as const;
}

// 6 ô số riêng thay vì 1 ô nhập chung — trải nghiệm quen thuộc của form OTP, tự nhảy ô kế
// tiếp khi gõ, lùi ô khi xoá ô rỗng, dán được cả mã 6 số cùng lúc. Giá trị thật submit qua
// 1 input ẩn "code" ghép từ các ô, server không đổi gì.
export function OtpDigitInputs({ digits, onChange }: { digits: string[]; onChange: (next: string[]) => void }) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  function setDigit(index: number, raw: string) {
    const clean = raw.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = clean;
    onChange(next);
    if (clean && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      // preventDefault bắt buộc: không thì trình duyệt vẫn áp hành động xoá mặc định của
      // phím Backspace này lên Ô VỪA ĐƯỢC FOCUS (ô trước đó) sau khi .focus() chạy xong,
      // xoá luôn số ở ô trước đó chỉ với 1 lần bấm (nhảy lùi 2 ô thay vì 1 mỗi lần bấm).
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;
    e.preventDefault();
    const next = pasted.split("");
    while (next.length < OTP_LENGTH) next.push("");
    onChange(next);
    inputRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
  }

  return (
    <div className="flex justify-between gap-2">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            inputRefs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          value={digit}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          aria-label={`Số thứ ${i + 1} của mã xác minh`}
          className="h-12 w-11 rounded-md border border-neutral-300 bg-surface text-center text-lg font-semibold text-text focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
        />
      ))}
    </div>
  );
}
