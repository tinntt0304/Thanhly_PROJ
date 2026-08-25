"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adjustUserCredit, type UserCreditSummary } from "@/lib/actions/credits";

const ROLE_LABEL: Record<string, string> = {
  SUPERADMIN: "Superadmin",
  SELLER: "Người bán",
};

export function UserCreditsManager({ users }: { users: UserCreditSummary[] }) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  async function handleAdjust(userId: string, sign: 1 | -1) {
    const raw = drafts[userId]?.trim();
    const amount = Number(raw);
    if (!raw || !Number.isFinite(amount) || amount <= 0) return;

    setSaving(userId);
    try {
      await adjustUserCredit(userId, amount * sign, sign > 0 ? "Superadmin cộng tay" : "Superadmin trừ tay");
      setDrafts((d) => ({ ...d, [userId]: "" }));
      router.refresh();
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-surface">
      <table className="w-full text-sm">
        <thead className="border-b border-neutral-200 bg-neutral-100 text-left text-xs uppercase text-neutral-700">
          <tr>
            <th className="px-4 py-2">Người dùng</th>
            <th className="px-4 py-2">Vai trò</th>
            <th className="px-4 py-2">Số dư</th>
            <th className="px-4 py-2">Điều chỉnh tay</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {users.map((u) => (
            <tr key={u.id}>
              <td className="px-4 py-2">
                <p className="font-medium text-text">{u.name}</p>
                <p className="text-xs text-neutral-500">{u.email}</p>
              </td>
              <td className="px-4 py-2 text-neutral-700">{ROLE_LABEL[u.role] ?? u.role}</td>
              <td className="px-4 py-2 font-medium text-text">{u.creditBalance.toLocaleString("vi-VN")}đ</td>
              <td className="px-4 py-2">
                <div className="flex items-center gap-1.5">
                  <input
                    value={drafts[u.id] ?? ""}
                    onChange={(e) => setDrafts((d) => ({ ...d, [u.id]: e.target.value }))}
                    placeholder="Số tiền"
                    type="number"
                    min={1}
                    className="w-28 rounded-md border border-neutral-300 bg-surface px-2 py-1 text-sm text-text focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
                  />
                  <button
                    type="button"
                    disabled={saving === u.id}
                    onClick={() => handleAdjust(u.id, 1)}
                    className="rounded-md border border-accent-2-300 bg-accent-2-100/50 px-2 py-1 text-xs font-medium text-accent-2-700 hover:bg-accent-2-100 disabled:opacity-50"
                  >
                    + Cộng
                  </button>
                  <button
                    type="button"
                    disabled={saving === u.id}
                    onClick={() => handleAdjust(u.id, -1)}
                    className="rounded-md border border-red-200 bg-red-50/50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    − Trừ
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
