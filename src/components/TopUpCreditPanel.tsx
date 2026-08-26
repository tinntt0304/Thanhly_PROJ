"use client";

import { useEffect, useState } from "react";
import {
  createTopUpRequest,
  getTopUpRequestStatus,
  listMyCreditTransactions,
  type CreditTransactionDTO,
} from "@/lib/actions/credits";

const inputClass =
  "rounded-md border border-neutral-300 bg-surface px-3 py-2 text-sm text-text focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500";

const TX_TYPE_LABEL: Record<string, string> = {
  TOPUP: "Nạp credit",
  SEARCH_CHARGE: "Tìm nhóm Facebook",
  ADJUSTMENT: "Điều chỉnh bởi quản trị viên",
};

type PendingTopUp = {
  requestId: string;
  referenceCode: string;
  qrUrl: string | null;
  amount: number;
};

export function TopUpCreditPanel({
  initialBalance,
  minTopUpAmount,
  maxTopUpAmount,
}: {
  initialBalance: number;
  minTopUpAmount: number;
  maxTopUpAmount: number | null;
}) {
  const [balance, setBalance] = useState(initialBalance);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingTopUp | null>(null);
  const [completed, setCompleted] = useState(false);
  const [transactions, setTransactions] = useState<CreditTransactionDTO[] | null>(null);

  useEffect(() => {
    listMyCreditTransactions().then(setTransactions);
  }, [balance]);

  // Poll trạng thái yêu cầu nạp mỗi 3 giây cho tới khi webhook SePay xác nhận xong —
  // setState chỉ chạy trong callback bất đồng bộ của setInterval, không đồng bộ ngay
  // trong effect, nên không vi phạm react-hooks/set-state-in-effect.
  useEffect(() => {
    if (!pending || completed) return;
    const id = setInterval(async () => {
      const status = await getTopUpRequestStatus(pending.requestId);
      if (status?.status === "COMPLETED") {
        setCompleted(true);
        setBalance((b) => b + (status.creditedAmount ?? 0));
      }
    }, 3000);
    return () => clearInterval(id);
  }, [pending, completed]);

  async function handleCreate(formData: FormData) {
    setCreating(true);
    setError(null);
    setCompleted(false);
    try {
      const res = await createTopUpRequest(formData);
      if (res.ok) {
        setPending({ requestId: res.requestId, referenceCode: res.referenceCode, qrUrl: res.qrUrl, amount: res.amount });
      } else {
        setError(res.error);
        setPending(null);
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-neutral-200 bg-surface p-4">
        <p className="text-sm text-neutral-600">Số dư hiện tại</p>
        <p className="font-heading text-2xl font-bold text-text">{balance.toLocaleString("vi-VN")}đ</p>
      </div>

      {!pending && (
        <form action={handleCreate} className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-surface p-4">
          <h2 className="font-heading text-base font-bold text-text">Nạp credit</h2>
          <div className="flex flex-col gap-1">
            <label htmlFor="amount" className="text-sm font-medium text-text">
              Số tiền muốn nạp (VNĐ)
            </label>
            <input
              id="amount"
              name="amount"
              type="number"
              min={minTopUpAmount}
              max={maxTopUpAmount ?? undefined}
              placeholder="100000"
              required
              className={inputClass}
            />
            <p className="text-xs text-neutral-500">
              Tối thiểu {minTopUpAmount.toLocaleString("vi-VN")}đ
              {maxTopUpAmount !== null && ` — tối đa ${maxTopUpAmount.toLocaleString("vi-VN")}đ`}/lượt.
            </p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={creating}
            className="self-start rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600 disabled:opacity-50"
          >
            {creating ? "Đang tạo mã..." : "Tạo mã QR chuyển khoản"}
          </button>
        </form>
      )}

      {pending && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-neutral-200 bg-surface p-4 text-center">
          <h2 className="font-heading text-base font-bold text-text">
            Chuyển khoản {pending.amount.toLocaleString("vi-VN")}đ
          </h2>

          {completed ? (
            <div className="flex flex-col items-center gap-2 py-4">
              <span className="text-3xl">✅</span>
              <p className="text-sm font-medium text-accent-2-700">Đã nạp thành công!</p>
              <button
                type="button"
                onClick={() => setPending(null)}
                className="mt-2 rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
              >
                Nạp thêm
              </button>
            </div>
          ) : pending.qrUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pending.qrUrl} alt="Mã QR chuyển khoản" className="h-64 w-64 rounded-md border border-neutral-200" />
              <p className="text-sm text-neutral-700">
                Nội dung chuyển khoản: <span className="font-mono font-semibold text-text">{pending.referenceCode}</span>
              </p>
              <p className="text-xs text-neutral-500">
                Quét mã bằng app ngân hàng — hệ thống tự cộng credit trong ít phút sau khi nhận được tiền.
              </p>
              <div className="mt-2 flex items-center gap-2 text-xs text-neutral-500">
                <span className="h-2 w-2 animate-pulse rounded-full bg-accent-500" />
                Đang chờ thanh toán...
              </div>
            </>
          ) : (
            <p className="text-sm text-red-600">
              Chưa cấu hình tài khoản nhận tiền — liên hệ quản trị viên để hoàn tất thiết lập.
            </p>
          )}

          {!completed && (
            <button
              type="button"
              onClick={() => setPending(null)}
              className="text-sm text-neutral-500 underline"
            >
              Huỷ, nhập số tiền khác
            </button>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="font-heading text-base font-bold text-text">Lịch sử giao dịch</h2>
        {transactions === null ? (
          <p className="text-sm text-neutral-500">Đang tải...</p>
        ) : transactions.length === 0 ? (
          <p className="text-sm text-neutral-500">Chưa có giao dịch nào.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-surface">
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-100 text-left text-xs uppercase text-neutral-700">
                <tr>
                  <th className="px-4 py-2">Loại</th>
                  <th className="px-4 py-2">Số tiền</th>
                  <th className="px-4 py-2">Số dư sau</th>
                  <th className="px-4 py-2">Thời gian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="px-4 py-2 text-text">
                      {TX_TYPE_LABEL[tx.type] ?? tx.type}
                      {tx.description && <span className="block text-xs text-neutral-500">{tx.description}</span>}
                    </td>
                    <td className={`px-4 py-2 font-medium ${tx.amount >= 0 ? "text-accent-2-700" : "text-red-600"}`}>
                      {tx.amount >= 0 ? "+" : ""}
                      {tx.amount.toLocaleString("vi-VN")}đ
                    </td>
                    <td className="px-4 py-2 text-neutral-700">{tx.balanceAfter.toLocaleString("vi-VN")}đ</td>
                    <td className="px-4 py-2 text-neutral-500">
                      {new Date(tx.createdAt).toLocaleString("vi-VN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
