"use server";

import { z } from "zod";
import { requireSuperAdmin } from "@/lib/admin-guard";
import {
  runFacebookGroupsSearch,
  MAX_ITEMS_LIMIT,
  type FacebookGroupItem,
} from "@/lib/facebook-groups";

const searchSchema = z.object({
  keywords: z.string().trim().min(1, "Nhập ít nhất 1 từ khóa"),
  maxItems: z.coerce.number().int().min(1).max(MAX_ITEMS_LIMIT),
});

export type FacebookGroupsSearchResult =
  | { ok: true; items: FacebookGroupItem[] }
  | { ok: false; error: string };

export async function searchFacebookGroups(formData: FormData): Promise<FacebookGroupsSearchResult> {
  await requireSuperAdmin();

  const parsed = searchSchema.safeParse({
    keywords: formData.get("keywords"),
    maxItems: formData.get("maxItems") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }

  const keywords = parsed.data.keywords
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  if (keywords.length === 0) {
    return { ok: false, error: "Nhập ít nhất 1 từ khóa." };
  }

  try {
    const items = await runFacebookGroupsSearch(keywords, parsed.data.maxItems);
    return { ok: true, items };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Không gọi được API tìm kiếm." };
  }
}
