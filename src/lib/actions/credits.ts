"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireSuperAdmin } from "@/lib/admin-guard";
import { getPricePerResult, setPricePerResult, getMaxTopUpAmount, setMaxTopUpAmount } from "@/lib/credits";
import { generateTopUpReferenceCode, buildTopUpQrUrl } from "@/lib/sepay";

const MIN_TOPUP_AMOUNT = 10_000;

export type CreateTopUpResult =
  | { ok: true; requestId: string; referenceCode: string; qrUrl: string | null; amount: number }
  | { ok: false; error: string };

export async function createTopUpRequest(formData: FormData): Promise<CreateTopUpResult> {
  const session = await requireAdmin();

  const parsed = z
    .object({ amount: z.coerce.number().int().min(MIN_TOPUP_AMOUNT, `Số tiền nạp tối thiểu ${MIN_TOPUP_AMOUNT.toLocaleString("vi-VN")}đ.`) })
    .safeParse({ amount: formData.get("amount") });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Số tiền không hợp lệ." };
  }

  const maxTopUpAmount = await getMaxTopUpAmount();
  if (maxTopUpAmount !== null && parsed.data.amount > maxTopUpAmount) {
    return {
      ok: false,
      error: `Số tiền nạp tối đa cho phép là ${maxTopUpAmount.toLocaleString("vi-VN")}đ.`,
    };
  }

  const referenceCode = generateTopUpReferenceCode();
  const request = await prisma.topUpRequest.create({
    data: { userId: session.user.id, amount: parsed.data.amount, referenceCode },
  });

  const qrUrl = buildTopUpQrUrl(parsed.data.amount, referenceCode);
  return { ok: true, requestId: request.id, referenceCode, qrUrl, amount: parsed.data.amount };
}

export type TopUpStatusResult = {
  status: "PENDING" | "COMPLETED" | "EXPIRED";
  creditedAmount: number | null;
};

export async function getTopUpRequestStatus(requestId: string): Promise<TopUpStatusResult | null> {
  const session = await requireAdmin();
  const request = await prisma.topUpRequest.findUnique({ where: { id: requestId } });
  if (!request || request.userId !== session.user.id) return null;
  return { status: request.status, creditedAmount: request.creditedAmount };
}

export type MyCreditInfo = { balance: number; pricePerResult: number; maxTopUpAmount: number | null };

export async function getMyCreditInfo(): Promise<MyCreditInfo> {
  const session = await requireAdmin();
  const [user, pricePerResult, maxTopUpAmount] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id }, select: { creditBalance: true } }),
    getPricePerResult(),
    getMaxTopUpAmount(),
  ]);
  return { balance: user?.creditBalance ?? 0, pricePerResult, maxTopUpAmount };
}

export type CreditTransactionDTO = {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string | null;
  createdAt: string;
};

export async function listMyCreditTransactions(): Promise<CreditTransactionDTO[]> {
  const session = await requireAdmin();
  const rows = await prisma.creditTransaction.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    amount: r.amount,
    balanceAfter: r.balanceAfter,
    description: r.description,
    createdAt: r.createdAt.toISOString(),
  }));
}

// ===== Superadmin: cấu hình giá + xem/điều chỉnh số dư người bán =====

export type PricingFormState = { error?: string };

export async function updatePricePerResult(
  _prevState: PricingFormState | undefined,
  formData: FormData
): Promise<PricingFormState> {
  await requireSuperAdmin();

  const parsed = z.object({ pricePerResult: z.coerce.number().int().min(1) }).safeParse({
    pricePerResult: formData.get("pricePerResult"),
  });
  if (!parsed.success) return { error: "Giá không hợp lệ." };

  await setPricePerResult(parsed.data.pricePerResult);
  revalidatePath("/admin/danh-muc");
  return {};
}

export type MaxTopUpFormState = { error?: string };

export async function updateMaxTopUpAmount(
  _prevState: MaxTopUpFormState | undefined,
  formData: FormData
): Promise<MaxTopUpFormState> {
  await requireSuperAdmin();

  // Ô để trống -> không giới hạn (null); có nhập thì phải là số nguyên dương.
  const raw = formData.get("maxTopUpAmount");
  if (!raw || raw === "") {
    await setMaxTopUpAmount(null);
    revalidatePath("/admin/danh-muc");
    return {};
  }

  const parsed = z.object({ maxTopUpAmount: z.coerce.number().int().min(MIN_TOPUP_AMOUNT) }).safeParse({
    maxTopUpAmount: raw,
  });
  if (!parsed.success) return { error: `Giới hạn nạp phải ≥ ${MIN_TOPUP_AMOUNT.toLocaleString("vi-VN")}đ.` };

  await setMaxTopUpAmount(parsed.data.maxTopUpAmount);
  revalidatePath("/admin/danh-muc");
  return {};
}

export type UserCreditSummary = {
  id: string;
  name: string;
  email: string;
  role: string;
  creditBalance: number;
};

export async function listUserCredits(): Promise<UserCreditSummary[]> {
  await requireSuperAdmin();
  const users = await prisma.user.findMany({
    orderBy: { creditBalance: "desc" },
    select: { id: true, name: true, email: true, role: true, creditBalance: true },
  });
  return users;
}

export async function adjustUserCredit(userId: string, amount: number, description: string): Promise<void> {
  await requireSuperAdmin();
  if (amount === 0) return;

  await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: { creditBalance: { increment: amount } },
    });
    await tx.creditTransaction.create({
      data: { userId, type: "ADJUSTMENT", amount, balanceAfter: updated.creditBalance, description },
    });
  });

  revalidatePath("/admin/danh-muc");
}
