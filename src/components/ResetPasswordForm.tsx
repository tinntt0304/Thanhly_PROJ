"use client";

import { useState } from "react";
import type { FormEvent } from "react";
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

// 2 bước: (1) nhập mật khẩu mới trước — chỉ validate phía client (độ dài, khớp nhau) chứ
// chưa gửi lên server; (2) mới tới màn hình nhập mã OTP để hoàn tất. Mã OTP đã được gửi từ
// lúc submit email ở /admin/forgot-password (trước khi vào trang này), không cần gửi lại gì
// thêm khi chuyển bước — resetPasswordAction chỉ nhận được đủ 4 trường (email/code/mật khẩu)
// ở bước 2, đúng 1 lần submit như cũ.
export function ResetPasswordForm({ email }: { email: string }) {
  const [step, setStep] = useState<"password" | "otp">("password");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [resetState, resetFormAction, resetPending] = useActionState(resetPasswordAction, initialResetState);
  const [resendState, resendFormAction, resendPending] = useActionState(resendResetOtpAction, initialResendState);
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [cooldown, resetCooldown] = useResendCooldown();

  function handleContinue(e: FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) {
      setPasswordError("Mật khẩu phải có ít nhất 6 ký tự");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Mật khẩu nhập lại không khớp");
      return;
    }
    setPasswordError(null);
    setStep("otp");
  }

  if (step === "password") {
    return (
      <form onSubmit={handleContinue} className="flex w-full max-w-sm flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="newPassword" className="text-sm font-medium text-text">
            Mật khẩu mới
          </label>
          <input
            id="newPassword"
            type="password"
            minLength={6}
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="confirmPassword" className="text-sm font-medium text-text">
            Nhập lại mật khẩu mới
          </label>
          <input
            id="confirmPassword"
            type="password"
            minLength={6}
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={inputClass}
          />
        </div>
        {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
        <button
          type="submit"
          className="rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600"
        >
          Tiếp tục
        </button>
      </form>
    );
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <form action={resetFormAction} className="flex flex-col gap-3">
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="code" value={digits.join("")} />
        <input type="hidden" name="newPassword" value={newPassword} />
        <input type="hidden" name="confirmPassword" value={confirmPassword} />
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-text">Mã xác minh (6 số)</label>
          <OtpDigitInputs digits={digits} onChange={setDigits} />
        </div>

        {resetState.error && <p className="text-sm text-red-600">{resetState.error}</p>}
        <button
          type="submit"
          disabled={resetPending || digits.join("").length !== OTP_LENGTH}
          className="rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600 disabled:opacity-50"
        >
          {resetPending ? "Đang đặt lại..." : "Hoàn tất đặt lại mật khẩu"}
        </button>
        <button
          type="button"
          onClick={() => setStep("password")}
          className="text-sm text-neutral-600 underline"
        >
          Quay lại đổi mật khẩu
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
