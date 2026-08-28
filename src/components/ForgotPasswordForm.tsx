"use client";

import { useActionState } from "react";
import { forgotPasswordAction, type ForgotPasswordState } from "@/lib/actions/auth";

const initialState: ForgotPasswordState = {};

const inputClass =
  "rounded-md border border-neutral-300 bg-surface px-3 py-2 text-sm text-text focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500";

// Luôn chuyển hướng sang /admin/reset-password khi submit xong (kể cả email không tồn tại
// hoặc bị rate-limit — forgotPasswordAction cố ý không tiết lộ khác biệt), nên form này
// không cần hiển thị lỗi.
export function ForgotPasswordForm() {
  const [, formAction, pending] = useActionState(forgotPasswordAction, initialState);

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium text-text">
          Email đã đăng ký
        </label>
        <input id="email" name="email" type="email" required className={inputClass} />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600 disabled:opacity-50"
      >
        {pending ? "Đang gửi..." : "Gửi mã đặt lại mật khẩu"}
      </button>
    </form>
  );
}
