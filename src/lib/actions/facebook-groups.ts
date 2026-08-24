"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/admin-guard";
import {
  runFacebookGroupsSearch,
  MAX_ITEMS_LIMIT,
  SEARCH_CACHE_HOURS,
  type FacebookGroupItem,
} from "@/lib/facebook-groups";

export type FacebookGroupResultItem = {
  fbId: string;
  name: string;
  url: string;
  visibility: string | null;
  memberCount: number | null;
  postsPerDay: number | null;
  description: string | null;
  matchedKeywords: string[];
  isNew: boolean;
  fromCache: boolean;
};

export type CachedKeywordNotice = {
  keyword: string;
  searchedAt: string;
  resultCount: number;
  newCount: number;
};

export type FacebookGroupsSearchResult =
  | {
      ok: true;
      items: FacebookGroupResultItem[];
      cachedKeywords: CachedKeywordNotice[];
      searchedKeywords: string[];
    }
  | { ok: false; error: string };

const searchSchema = z.object({
  keywords: z.string().trim().min(1, "Nhập ít nhất 1 từ khóa"),
  maxItems: z.coerce.number().int().min(1).max(MAX_ITEMS_LIMIT),
  forceRefresh: z.coerce.boolean(),
});

function normalizeKeyword(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

// Dùng làm khóa so khớp cache (không phân biệt hoa/thường) — vẫn giữ nguyên chữ gốc
// (có dấu) khi gửi cho Apify vì đó là searchable text thật, không phải tìm kiếm nội bộ.
function cacheKey(keyword: string): string {
  return keyword.toLowerCase();
}

export async function searchFacebookGroups(formData: FormData): Promise<FacebookGroupsSearchResult> {
  await requireSuperAdmin();

  const parsed = searchSchema.safeParse({
    keywords: formData.get("keywords"),
    maxItems: formData.get("maxItems") || undefined,
    forceRefresh: formData.get("forceRefresh") === "on",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }

  const keywords = [
    ...new Set(
      parsed.data.keywords
        .split(",")
        .map(normalizeKeyword)
        .filter(Boolean)
    ),
  ];
  if (keywords.length === 0) {
    return { ok: false, error: "Nhập ít nhất 1 từ khóa." };
  }
  const { maxItems, forceRefresh } = parsed.data;

  // Với mỗi từ khóa: nếu không bắt buộc tìm lại VÀ đã có lượt tìm trong SEARCH_CACHE_HOURS
  // giờ gần đây, phục vụ từ DB (không gọi Apify) để tiết kiệm credit.
  const cacheCutoff = new Date(Date.now() - SEARCH_CACHE_HOURS * 3600 * 1000);
  const cachedKeywords: CachedKeywordNotice[] = [];
  const keywordsToSearch: string[] = [];

  if (forceRefresh) {
    keywordsToSearch.push(...keywords);
  } else {
    for (const keyword of keywords) {
      const recent = await prisma.facebookKeywordSearch.findFirst({
        where: { keyword: cacheKey(keyword), searchedAt: { gte: cacheCutoff } },
        orderBy: { searchedAt: "desc" },
      });
      if (recent) {
        cachedKeywords.push({
          keyword,
          searchedAt: recent.searchedAt.toISOString(),
          resultCount: recent.resultCount,
          newCount: recent.newCount,
        });
      } else {
        keywordsToSearch.push(keyword);
      }
    }
  }

  const resultItems = new Map<string, FacebookGroupResultItem>();

  // 1 lượt gọi Apify duy nhất cho TẤT CẢ từ khóa cần tìm mới (actor nhận mảng từ khóa),
  // thay vì gọi riêng từng từ khóa — giảm số lần gọi API.
  if (keywordsToSearch.length > 0) {
    let liveItems: FacebookGroupItem[];
    try {
      liveItems = await runFacebookGroupsSearch(keywordsToSearch, maxItems);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Không gọi được API tìm kiếm." };
    }

    const countsByKeyword = new Map<string, { resultCount: number; newCount: number }>();
    for (const keyword of keywordsToSearch) {
      countsByKeyword.set(cacheKey(keyword), { resultCount: 0, newCount: 0 });
    }

    for (const item of liveItems) {
      if (!item.id) continue;
      const matchedKeyword = item.query ?? keywordsToSearch[0];
      const counts = countsByKeyword.get(cacheKey(matchedKeyword));
      if (counts) counts.resultCount += 1;

      const existing = await prisma.facebookGroup.findUnique({ where: { fbId: item.id } });
      const isNew = !existing;
      if (isNew && counts) counts.newCount += 1;

      // Lưu từ khóa dạng đã chuẩn hoá (lowercase) trong keywords[] — khớp nhất quán với
      // cacheKey() dùng để tra cứu lại nhóm theo từ khóa cache ở dưới, tránh trường hợp
      // gõ khác hoa/thường giữa 2 lần tìm khiến không tìm lại được nhóm đã lưu.
      const mergedKeywords = new Set(existing?.keywords ?? []);
      mergedKeywords.add(cacheKey(matchedKeyword));

      const saved = await prisma.facebookGroup.upsert({
        where: { fbId: item.id },
        update: {
          name: item.name,
          url: item.url,
          visibility: item.visibility,
          memberCount: item.memberCount,
          postsPerDay: item.postsPerDay,
          description: item.description,
          keywords: [...mergedKeywords],
        },
        create: {
          fbId: item.id,
          name: item.name,
          url: item.url,
          visibility: item.visibility,
          memberCount: item.memberCount,
          postsPerDay: item.postsPerDay,
          description: item.description,
          keywords: [...mergedKeywords],
        },
      });

      resultItems.set(saved.fbId, {
        fbId: saved.fbId,
        name: saved.name,
        url: saved.url,
        visibility: saved.visibility,
        memberCount: saved.memberCount,
        postsPerDay: saved.postsPerDay,
        description: saved.description,
        matchedKeywords: saved.keywords,
        isNew,
        fromCache: false,
      });
    }

    await prisma.facebookKeywordSearch.createMany({
      data: keywordsToSearch.map((keyword) => ({
        keyword: cacheKey(keyword),
        maxItems,
        resultCount: countsByKeyword.get(cacheKey(keyword))?.resultCount ?? 0,
        newCount: countsByKeyword.get(cacheKey(keyword))?.newCount ?? 0,
      })),
    });
  }

  // Từ khóa phục vụ từ cache: lấy lại nhóm đã lưu có gắn từ khóa đó, không gọi Apify.
  for (const cached of cachedKeywords) {
    const saved = await prisma.facebookGroup.findMany({
      where: { keywords: { has: cacheKey(cached.keyword) } },
      orderBy: { lastSeenAt: "desc" },
      take: maxItems,
    });
    for (const g of saved) {
      if (resultItems.has(g.fbId)) continue;
      resultItems.set(g.fbId, {
        fbId: g.fbId,
        name: g.name,
        url: g.url,
        visibility: g.visibility,
        memberCount: g.memberCount,
        postsPerDay: g.postsPerDay,
        description: g.description,
        matchedKeywords: g.keywords,
        isNew: false,
        fromCache: true,
      });
    }
  }

  return {
    ok: true,
    items: [...resultItems.values()],
    cachedKeywords,
    searchedKeywords: keywordsToSearch,
  };
}

export type SavedFacebookGroup = {
  fbId: string;
  name: string;
  url: string;
  visibility: string | null;
  memberCount: number | null;
  postsPerDay: number | null;
  description: string | null;
  keywords: string[];
  firstFoundAt: string;
  lastSeenAt: string;
};

export async function listSavedFacebookGroups(query?: string): Promise<SavedFacebookGroup[]> {
  await requireSuperAdmin();

  const trimmed = query?.trim();
  const groups = await prisma.facebookGroup.findMany({
    where: trimmed
      ? {
          OR: [
            { name: { contains: trimmed, mode: "insensitive" } },
            { keywords: { has: trimmed.toLowerCase() } },
          ],
        }
      : undefined,
    orderBy: { lastSeenAt: "desc" },
    take: 300,
  });

  return groups.map((g) => ({
    fbId: g.fbId,
    name: g.name,
    url: g.url,
    visibility: g.visibility,
    memberCount: g.memberCount,
    postsPerDay: g.postsPerDay,
    description: g.description,
    keywords: g.keywords,
    firstFoundAt: g.firstFoundAt.toISOString(),
    lastSeenAt: g.lastSeenAt.toISOString(),
  }));
}
