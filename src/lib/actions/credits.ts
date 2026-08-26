"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireSuperAdmin } from "@/lib/admin-guard";
import {
  getPricePerResult,
  setPricePerResult,
  getMinTopUpAmount,
  setMinTopUpAmount,
  getMaxTopUpAmount,
  setMaxTopUpAmount,
  TOPUP_QR_EXPIRY_SECONDS,
} from "@/lib/credits";
import { generateTopUpReferenceCode, buildTopUpQrUrl } from "@/lib/sepay";

export type CreateTopUpResult =
  | { ok: true; requestId: string; referenceCode: string; qrUrl: string | null; amount: number; expiresAt: string }
  | { ok: false; error: string };

export async function createTopUpRequest(formData: FormData): Promise<CreateTopUpResult> {
  const session = await requireAdmin();

  const [minTopUpAmount, maxTopUpAmount] = await Promise.all([getMinTopUpAmount(), getMaxTopUpAmount()]);

  const parsed = z
    .object({
      amount: z.coerce
        .number()
        .int()
        .min(minTopUpAmount, `Số tiền nạp tối thiểu ${minTopUpAmount.toLocaleString("vi-VN")}đ.`),
    })
    .safeParse({ amount: formData.get("amount") });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Số tiền không hợp lệ." };
  }

  if (maxTopUpAmount !== null && parsed.data.amount > maxTopUpAmount) {
    return {
      ok: false,
      error: `Số tiền nạp tối đa cho phép là ${maxTopUpAmount.toLocaleString("vi-VN")}đ.`,
    };
  }

  // Chặn spam tạo hàng loạt TopUpRequest (mỗi request là 1 dòng DB, không có giới hạn gì
  // trước đây — 1 script có thể tạo vô số dòng/giây): chỉ cho phép tạo mã QR mới nếu
  // không còn yêu cầu PENDING nào của tài khoản này còn hiệu lực (chưa hết hạn theo
  // TOPUP_QR_EXPIRY_SECONDS). Không cần chặt chẽ tuyệt đối (không dùng transaction khoá
  // dòng) vì hậu quả tệ nhất chỉ là vài dòng dư trong lúc double-click, không phải lỗ
  // hổng bảo mật — mục tiêu là chặn vòng lặp script, không phải chặn 1 double-click.
  const pendingCutoff = new Date(Date.now() - TOPUP_QR_EXPIRY_SECONDS * 1000);
  const stillPending = await prisma.topUpRequest.findFirst({
    where: { userId: session.user.id, status: "PENDING", createdAt: { gt: pendingCutoff } },
  });
  if (stillPending) {
    return {
      ok: false,
      error: "Bạn đang có 1 yêu cầu nạp credit chưa hoàn tất — vui lòng quét mã đó hoặc đợi hết hạn trước khi tạo mã mới.",
    };
  }

  const referenceCode = generateTopUpReferenceCode();
  const request = await prisma.topUpRequest.create({
    data: { userId: session.user.id, amount: parsed.data.amount, referenceCode },
  });

  const qrUrl = buildTopUpQrUrl(parsed.data.amount, referenceCode);
  const expiresAt = new Date(request.createdAt.getTime() + TOPUP_QR_EXPIRY_SECONDS * 1000).toISOString();
  return { ok: true, requestId: request.id, referenceCode, qrUrl, amount: parsed.data.amount, expiresAt };
}

// Người dùng chủ động huỷ (nút "Huỷ, nhập số tiền khác") — đánh dấu EXPIRED ngay thay vì
// để PENDING treo tới khi hết hạn tự nhiên, nếu không request này sẽ chặn nhầm việc tạo
// mã QR mới của chính họ (do giới hạn "chỉ 1 PENDING/lần" ở createTopUpRequest).
export async function cancelTopUpRequest(requestId: string): Promise<void> {
  const session = await requireAdmin();
  await prisma.topUpRequest.updateMany({
    where: { id: requestId, userId: session.user.id, status: "PENDING" },
    data: { status: "EXPIRED" },
  });
}

export type TopUpStatusResult = {
  status: "PENDING" | "COMPLETED" | "EXPIRED";
  creditedAmount: number | null;
};

// Trạng thái EXPIRED được SUY RA từ createdAt + TOPUP_QR_EXPIRY_SECONDS khi request vẫn
// còn PENDING trong DB — không lưu trực tiếp, giống cách P0.3 suy ra trạng thái phiên đấu
// giá từ endTime, tránh cần cron job. Nếu SePay xác nhận trễ (đã COMPLETED trong DB) thì
// trạng thái thật trong DB luôn thắng, không bao giờ báo "hết hạn" cho 1 giao dịch đã
// nhận được tiền.
export async function getTopUpRequestStatus(requestId: string): Promise<TopUpStatusResult | null> {
  const session = await requireAdmin();
  const request = await prisma.topUpRequest.findUnique({ where: { id: requestId } });
  if (!request || request.userId !== session.user.id) return null;

  const isPastExpiry =
    request.status === "PENDING" &&
    Date.now() - request.createdAt.getTime() > TOPUP_QR_EXPIRY_SECONDS * 1000;

  return {
    status: isPastExpiry ? "EXPIRED" : request.status,
    creditedAmount: request.creditedAmount,
  };
}

export type MyCreditInfo = {
  balance: number;
  pricePerResult: number;
  minTopUpAmount: number;
  maxTopUpAmount: number | null;
};

export async function getMyCreditInfo(): Promise<MyCreditInfo> {
  const session = await requireAdmin();
  const [user, pricePerResult, minTopUpAmount, maxTopUpAmount] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id }, select: { creditBalance: true } }),
    getPricePerResult(),
    getMinTopUpAmount(),
    getMaxTopUpAmount(),
  ]);
  return { balance: user?.creditBalance ?? 0, pricePerResult, minTopUpAmount, maxTopUpAmount };
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

export type TopUpLimitsFormState = { error?: string };

export async function updateTopUpLimits(
  _prevState: TopUpLimitsFormState | undefined,
  formData: FormData
): Promise<TopUpLimitsFormState> {
  await requireSuperAdmin();

  const minParsed = z.object({ minTopUpAmount: z.coerce.number().int().min(1) }).safeParse({
    minTopUpAmount: formData.get("minTopUpAmount"),
  });
  if (!minParsed.success) return { error: "Số tiền nạp tối thiểu không hợp lệ." };

  // Ô tối đa để trống -> không giới hạn (null); có nhập thì phải là số nguyên dương.
  const maxRaw = formData.get("maxTopUpAmount");
  let maxTopUpAmount: number | null = null;
  if (maxRaw && maxRaw !== "") {
    const maxParsed = z.object({ maxTopUpAmount: z.coerce.number().int().min(1) }).safeParse({
      maxTopUpAmount: maxRaw,
    });
    if (!maxParsed.success) return { error: "Số tiền nạp tối đa không hợp lệ." };
    maxTopUpAmount = maxParsed.data.maxTopUpAmount;
  }

  if (maxTopUpAmount !== null && maxTopUpAmount < minParsed.data.minTopUpAmount) {
    return { error: "Số tiền nạp tối đa phải ≥ số tiền nạp tối thiểu." };
  }

  await Promise.all([setMinTopUpAmount(minParsed.data.minTopUpAmount), setMaxTopUpAmount(maxTopUpAmount)]);
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
