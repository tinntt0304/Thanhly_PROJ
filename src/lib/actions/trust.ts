"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { parseReviews } from "@/lib/reviews";

const trustSchema = z.object({
  avgRating: z.coerce.number().min(0).max(5),
  soldCount: z.coerce.number().int().min(0),
  reviewsText: z.string().optional().default(""),
});

export type TrustFormState = { error?: string };

export async function updateTrustProfile(
  _prevState: TrustFormState | undefined,
  formData: FormData
): Promise<TrustFormState> {
  await requireAdmin();

  const parsed = trustSchema.safeParse({
    avgRating: formData.get("avgRating"),
    soldCount: formData.get("soldCount"),
    reviewsText: formData.get("reviewsText"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }

  const { avgRating, soldCount, reviewsText } = parsed.data;
  const reviews = parseReviews(reviewsText);

  const existing = await prisma.trustProfile.findFirst();
  if (existing) {
    await prisma.trustProfile.update({
      where: { id: existing.id },
      data: { avgRating, soldCount, reviews },
    });
  } else {
    await prisma.trustProfile.create({ data: { avgRating, soldCount, reviews } });
  }

  revalidatePath("/");
  revalidatePath("/admin/settings");
  return {};
}
