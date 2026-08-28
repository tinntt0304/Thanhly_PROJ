"use client";

import { useState } from "react";
import { useActionState } from "react";
import {
  resetPasswordAction,
  resendResetOtpAction,
  type ResetPasswordState,
  type ResendOtpState,
} from "@/lib/actions/auth";
import { OTP_LENGTH, OtpDigitInputs, formatCooldown, useResendCooldown } from "@/components/OtpDigitInputs";

const initialResetState: ResetPasswordState = {};
const initialResendState: ResendOtpState = {};

const inputClass =
  "rounded-md border border-neutral-300 bg-surface px-3 py-2 text-sm text-text focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500";

export function ResetPasswordForm({ email }: { email: string }) {
  const [resetState, resetFormAction, resetPending] = useActionState(resetPasswordAction, initialResetState);
  const [resendState, resendFormAction, resendPending] = useActionState(resendResetOtpAction, initialResendState);
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [cooldown, resetCooldown] = useResendCooldown();

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <form action={resetFormAction} className="flex flex-col gap-3">
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="code" value={digits.join("")} />
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-text">Mã xác minh (6 số)</label>
          <OtpDigitInputs digits={digits} onChange={setDigits} />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="newPassword" className="text-sm font-medium text-text">
            Mật khẩu mới
          </label>
          <input
            id="newPassword"
            name="newPassword"
            type="password"
            minLength={6}
            required
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="confirmPassword" className="text-sm font-medium text-text">
            Nhập lại mật khẩu mới
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            minLength={6}
            required
            className={inputClass}
          />
        </div>

        {resetState.error && <p className="text-sm text-red-600">{resetState.error}</p>}
        <button
          type="submit"
          disabled={resetPending || digits.join("").length !== OTP_LENGTH}
          className="rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600 disabled:opacity-50"
        >
          {resetPending ? "Đang đặt lại..." : "Đặt lại mật khẩu"}
        </button>
      </form>

      <form
        action={(formData) => {
          resetCooldown();
          setDigits(Array(OTP_LENGTH).fill(""));
          resendFormAction(formData);
        }}
      >
        <input type="hidden" name="email" value={email} />
        <button
          type="submit"
          disabled={resendPending || cooldown > 0}
          className="text-sm text-accent-600 underline disabled:cursor-not-allowed disabled:text-neutral-400 disabled:no-underline"
        >
          {resendPending
            ? "Đang gửi..."
            : cooldown > 0
              ? `Gửi lại mã sau ${formatCooldown(cooldown)}`
              : "Gửi lại mã"}
        </button>
        {resendState.success && <p className="mt-1 text-sm text-accent-2-700">Đã gửi lại mã, kiểm tra email.</p>}
        {resendState.error && <p className="mt-1 text-sm text-red-600">{resendState.error}</p>}
      </form>
    </div>
  );
}
