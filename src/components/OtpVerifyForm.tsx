"use client";

import { useActionState, useState } from "react";
import { verifyOtpAction, resendOtpAction, type OtpFormState, type ResendOtpState } from "@/lib/actions/auth";

const initialVerifyState: OtpFormState = {};
const initialResendState: ResendOtpState = {};

const inputClass =
  "rounded-md border border-neutral-300 bg-surface px-3 py-2 text-sm text-text focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500";

export function OtpVerifyForm({ email }: { email: string }) {
  const [verifyState, verifyFormAction, verifyPending] = useActionState(verifyOtpAction, initialVerifyState);
  const [resendState, resendFormAction, resendPending] = useActionState(resendOtpAction, initialResendState);
  const [resendCount, setResendCount] = useState(0);

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <form action={verifyFormAction} className="flex flex-col gap-3">
        <input type="hidden" name="email" value={email} />
        <div className="flex flex-col gap-1">
          <label htmlFor="code" className="text-sm font-medium text-text">
            Mã xác minh (6 số)
          </label>
          <input
            id="code"
            name="code"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            autoComplete="one-time-code"
            required
            className={`${inputClass} text-center text-lg tracking-[0.5em]`}
          />
        </div>
        {verifyState.error && <p className="text-sm text-red-600">{verifyState.error}</p>}
        <button
          type="submit"
          disabled={verifyPending}
          className="rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600 disabled:opacity-50"
        >
          {verifyPending ? "Đang xác minh..." : "Xác minh"}
        </button>
      </form>

      <form
        action={(formData) => {
          setResendCount((c) => c + 1);
          resendFormAction(formData);
        }}
      >
        <input type="hidden" name="email" value={email} />
        <button
          type="submit"
          disabled={resendPending}
          className="text-sm text-accent-600 underline disabled:opacity-50"
        >
          {resendPending ? "Đang gửi..." : "Gửi lại mã"}
        </button>
        {resendState.success && resendCount > 0 && (
          <p className="mt-1 text-sm text-accent-2-700">Đã gửi lại mã, kiểm tra email.</p>
        )}
        {resendState.error && <p className="mt-1 text-sm text-red-600">{resendState.error}</p>}
      </form>
    </div>
  );
}
