import { prisma } from "@/lib/prisma";

// Apify: $4.99 / 1.000 kết quả (~130đ/kết quả ở tỉ giá ~26.000đ/$) + phí nền tảng Apify
// riêng không cố định. Giá mặc định dưới đây đã cộng thêm biên độ ~50% để bù phần phí
// nền tảng biến động + có lời — superadmin chỉnh lại bất cứ lúc nào ở /admin/danh-muc,
// đây chỉ là giá trị khởi tạo.
export const DEFAULT_PRICE_PER_RESULT = 200;

const PRICING_KEY = "facebook_search";

export async function getPricePerResult(): Promise<number> {
  const config = await prisma.pricingConfig.findUnique({ where: { key: PRICING_KEY } });
  return config?.pricePerResult ?? DEFAULT_PRICE_PER_RESULT;
}

export async function setPricePerResult(pricePerResult: number): Promise<void> {
  await prisma.pricingConfig.upsert({
    where: { key: PRICING_KEY },
    update: { pricePerResult },
    create: { key: PRICING_KEY, pricePerResult },
  });
}

// null = không giới hạn — mặc định chưa đặt giới hạn nào cho tới khi superadmin cấu
// hình ở /admin/danh-muc, tránh áp một con số tùy tiện không có căn cứ kinh doanh.
export async function getMaxTopUpAmount(): Promise<number | null> {
  const config = await prisma.pricingConfig.findUnique({ where: { key: PRICING_KEY } });
  return config?.maxTopUpAmount ?? null;
}

export async function setMaxTopUpAmount(maxTopUpAmount: number | null): Promise<void> {
  await prisma.pricingConfig.upsert({
    where: { key: PRICING_KEY },
    update: { maxTopUpAmount },
    create: { key: PRICING_KEY, pricePerResult: DEFAULT_PRICE_PER_RESULT, maxTopUpAmount },
  });
}

export async function getCreditBalance(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { creditBalance: true } });
  return user?.creditBalance ?? 0;
}

export type ChargeResult =
  | { ok: true; charged: number; balanceAfter: number }
  | { ok: false; error: string };

// Trừ credit cho 1 lượt tìm nhóm Facebook đã gọi Apify thật — atomic (đọc số dư + trừ +
// ghi sổ trong 1 transaction) để 2 lượt tìm gần như đồng thời của cùng 1 người không bị
// trừ tiền sai (race condition).
export async function chargeForSearch(
  userId: string,
  resultCount: number,
  pricePerResult: number,
  description: string
): Promise<ChargeResult> {
  const charge = resultCount * pricePerResult;
  if (charge <= 0) {
    return { ok: true, charged: 0, balanceAfter: await getCreditBalance(userId) };
  }

  try {
    const balanceAfter = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { creditBalance: true } });
      if (!user) throw new Error("NOT_FOUND");
      if (user.creditBalance < charge) throw new Error(`INSUFFICIENT:${user.creditBalance}`);

      const updated = await tx.user.update({
        where: { id: userId },
        data: { creditBalance: { decrement: charge } },
      });
      await tx.creditTransaction.create({
        data: {
          userId,
          type: "SEARCH_CHARGE",
          amount: -charge,
          balanceAfter: updated.creditBalance,
          description,
        },
      });
      return updated.creditBalance;
    });
    return { ok: true, charged: charge, balanceAfter };
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("INSUFFICIENT:")) {
      const balance = Number(e.message.split(":")[1]);
      return {
        ok: false,
        error: `Không đủ credit — lượt tìm này cần ${charge.toLocaleString("vi-VN")}đ, số dư hiện tại ${balance.toLocaleString("vi-VN")}đ.`,
      };
    }
    return { ok: false, error: "Có lỗi khi trừ credit, vui lòng thử lại." };
  }
}
