"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/admin-guard";

const contentSchema = z.object({
  content: z.string().trim().min(1, "Nội dung không được để trống"),
});

export type SiteContentFormState = { error?: string };

export async function updateSiteContent(
  key: string,
  _prevState: SiteContentFormState | undefined,
  formData: FormData
): Promise<SiteContentFormState> {
  await requireSuperAdmin();

  const parsed = contentSchema.safeParse({ content: formData.get("content") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }

  await prisma.siteContent.upsert({
    where: { key },
    update: { content: parsed.data.content },
    create: { key, content: parsed.data.content },
  });

  revalidatePath("/ve-chung-toi");
  revalidatePath("/admin/danh-muc");
  return {};
}
