"use client";

import Link from "next/link";
import { useActionState } from "react";
import { buyerLoginAction, type BuyerLoginFormState } from "@/lib/actions/buyer-auth";

const initialState: BuyerLoginFormState = {};

const inputClass =
  "rounded-md border border-neutral-300 bg-surface px-3 py-2 text-sm text-text focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500";

export function BuyerLoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(buyerLoginAction, initialState);

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-3">
      {next && <input type="hidden" name="next" value={next} />}
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
        <input id="password" name="password" type="password" required className={inputClass} />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600 disabled:opacity-50"
      >
        {pending ? "Đang đăng nhập..." : "Đăng nhập"}
      </button>
      <p className="text-sm text-neutral-700">
        Chưa có tài khoản?{" "}
        <Link
          href={next ? `/dang-ky?next=${encodeURIComponent(next)}` : "/dang-ky"}
          className="text-accent-600 underline"
        >
          Đăng ký
        </Link>
      </p>
    </form>
  );
}
