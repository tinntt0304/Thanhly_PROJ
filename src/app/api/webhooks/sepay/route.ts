import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  isValidSepayWebhookAuth,
  contentContainsReferenceCode,
  type SepayWebhookPayload,
} from "@/lib/sepay";

// SePay gọi endpoint này ngay khi phát hiện giao dịch chuyển khoản vào tài khoản ngân
// hàng đã liên kết. Không đặt sau requireAdmin() vì đây là request từ server SePay, không
// có phiên đăng nhập — xác thực bằng SEPAY_WEBHOOK_API_KEY trong header Authorization.
export async function POST(request: Request) {
  if (!isValidSepayWebhookAuth(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: SepayWebhookPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  // Chỉ xử lý tiền vào — giao dịch tiền ra (transferType "out") không liên quan nạp credit.
  if (payload.transferType !== "in" || !payload.transferAmount) {
    return NextResponse.json({ ok: true, skipped: "not an inbound transfer" });
  }

  const content = payload.content ?? payload.description ?? "";
  const pending = await prisma.topUpRequest.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
  });
  const matched = pending.find((r) => contentContainsReferenceCode(content, r.referenceCode));

  if (!matched) {
    // Không khớp yêu cầu nạp nào đang chờ — có thể là giao dịch khác không liên quan tới
    // credit. Trả 200 để SePay không retry vô hạn, nhưng KHÔNG cộng tiền cho ai cả.
    return NextResponse.json({ ok: true, skipped: "no matching top-up request" });
  }

  // Idempotent: webhook có thể được gọi lại (SePay retry khi timeout) — nếu request đã
  // COMPLETED thì bỏ qua, không cộng tiền lần 2 cho cùng 1 giao dịch ngân hàng.
  const result = await prisma.$transaction(async (tx) => {
    const fresh = await tx.topUpRequest.findUnique({ where: { id: matched.id } });
    if (!fresh || fresh.status !== "PENDING") return null;

    const creditedAmount = payload.transferAmount!;
    const updatedUser = await tx.user.update({
      where: { id: fresh.userId },
      data: { creditBalance: { increment: creditedAmount } },
    });
    await tx.creditTransaction.create({
      data: {
        userId: fresh.userId,
        type: "TOPUP",
        amount: creditedAmount,
        balanceAfter: updatedUser.creditBalance,
        description: `Nạp credit qua SePay — mã ${fresh.referenceCode}`,
      },
    });
    await tx.topUpRequest.update({
      where: { id: fresh.id },
      data: {
        status: "COMPLETED",
        creditedAmount,
        sepayRawContent: content,
        completedAt: new Date(),
      },
    });
    return { userId: fresh.userId, creditedAmount };
  });

  return NextResponse.json({ ok: true, processed: result !== null });
}
