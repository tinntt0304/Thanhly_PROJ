"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerBuyerAction, type BuyerRegisterFormState } from "@/lib/actions/buyer-auth";

const initialState: BuyerRegisterFormState = {};

const inputClass =
  "rounded-md border border-neutral-300 bg-surface px-3 py-2 text-sm text-text focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500";

export function BuyerRegisterForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(registerBuyerAction, initialState);

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-3">
      {next && <input type="hidden" name="next" value={next} />}
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium text-text">
          Họ tên
        </label>
        <input id="name" name="name" required className={inputClass} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="phone" className="text-sm font-medium text-text">
          Số điện thoại
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="numeric"
          maxLength={10}
          placeholder="0901234567"
          required
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium text-text">
          Mật khẩu
        </label>
        <input
          id="password"
          name="password"
          type="password"
          minLength={6}
          autoComplete="new-password"
          required
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="confirmPassword" className="text-sm font-medium text-text">
          Xác nhận mật khẩu
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          minLength={6}
          autoComplete="new-password"
          required
          className={inputClass}
        />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600 disabled:opacity-50"
      >
        {pending ? "Đang tạo tài khoản..." : "Đăng ký"}
      </button>
      <p className="text-sm text-neutral-700">
        Đã có tài khoản?{" "}
        <Link
          href={next ? `/dang-nhap?next=${encodeURIComponent(next)}` : "/dang-nhap"}
          className="text-accent-600 underline"
        >
          Đăng nhập
        </Link>
      </p>
    </form>
  );
}
