"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import {
  runFacebookGroupsSearch,
  MAX_ITEMS_LIMIT,
  SEARCH_CACHE_HOURS,
  SEARCH_RATE_LIMIT_SECONDS,
  SAVED_GROUPS_PAGE_SIZE,
  type FacebookGroupItem,
} from "@/lib/facebook-groups";
import { chargeForSearch, getPricePerResult } from "@/lib/credits";

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
      charged: number;
      balanceAfter: number | null; // null = superadmin, không tính phí nên không có ý nghĩa hiển thị
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
  const session = await requireAdmin();
  const isSuperAdmin = session.user.role === "SUPERADMIN";

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
        where: { userId: session.user.id, keyword: cacheKey(keyword), searchedAt: { gte: cacheCutoff } },
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
  const pricePerResult = await getPricePerResult();
  let charged = 0;
  let balanceAfter: number | null = null;

  // 1 lượt gọi Apify duy nhất cho TẤT CẢ từ khóa cần tìm mới (actor nhận mảng từ khóa),
  // thay vì gọi riêng từng từ khóa — giảm số lần gọi API.
  if (keywordsToSearch.length > 0) {
    // Chặn spam gọi Apify thật: chỉ cho phép nếu lượt gọi thật gần nhất của tài khoản
    // này (nếu có) đã cách đây đủ SEARCH_RATE_LIMIT_SECONDS. Dùng updateMany (UPDATE ...
    // WHERE) thay vì đọc rồi ghi riêng lẻ để atomic — 2 request gần như đồng thời từ
    // cùng 1 tài khoản (vd. script bỏ qua UI) không thể cùng "lọt qua" điều kiện, vì
    // Postgres khoá dòng và request thứ 2 luôn thấy lastSearchAt đã được request thứ
    // nhất cập nhật trước khi tự kiểm tra điều kiện.
    if (!isSuperAdmin) {
      const cooldownCutoff = new Date(Date.now() - SEARCH_RATE_LIMIT_SECONDS * 1000);
      const claimed = await prisma.user.updateMany({
        where: {
          id: session.user.id,
          OR: [{ lastSearchAt: null }, { lastSearchAt: { lt: cooldownCutoff } }],
        },
        data: { lastSearchAt: new Date() },
      });
      if (claimed.count === 0) {
        return {
          ok: false,
          error: `Vui lòng đợi ít nhất ${SEARCH_RATE_LIMIT_SECONDS} giây giữa các lượt tìm để tránh gọi API quá nhanh.`,
        };
      }
    }

    // Chặn trước khi gọi Apify nếu chắc chắn không đủ credit cho số kết quả tối đa có
    // thể trả về — tránh tốn credit Apify thật cho 1 lượt tìm mà người dùng không trả
    // nổi. Superadmin (chủ sàn) không bị tính phí.
    if (!isSuperAdmin) {
      const worstCaseCost = keywordsToSearch.length * maxItems * pricePerResult;
      const balance = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { creditBalance: true },
      });
      if ((balance?.creditBalance ?? 0) < worstCaseCost) {
        return {
          ok: false,
          error: `Số dư có thể không đủ cho lượt tìm này (tối đa ${worstCaseCost.toLocaleString("vi-VN")}đ nếu đủ ${maxItems} kết quả/từ khóa), số dư hiện tại ${(balance?.creditBalance ?? 0).toLocaleString("vi-VN")}đ. Giảm số kết quả hoặc nạp thêm credit.`,
        };
      }
    }

    let liveItems: FacebookGroupItem[];
    try {
      liveItems = await runFacebookGroupsSearch(keywordsToSearch, maxItems);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Không gọi được API tìm kiếm." };
    }

    if (!isSuperAdmin) {
      const chargeResult = await chargeForSearch(
        session.user.id,
        liveItems.length,
        pricePerResult,
        `Tìm nhóm Facebook: ${keywordsToSearch.join(", ")}`
      );
      if (!chargeResult.ok) {
        return { ok: false, error: chargeResult.error };
      }
      charged = chargeResult.charged;
      balanceAfter = chargeResult.balanceAfter;
    }

    const countsByKeyword = new Map<string, { resultCount: number; newCount: number }>();
    for (const keyword of keywordsToSearch) {
      countsByKeyword.set(cacheKey(keyword), { resultCount: 0, newCount: 0 });
    }

    // Trước đây tra + ghi từng nhóm TUẦN TỰ (findUnique rồi upsert riêng cho mỗi kết quả)
    // — tới 2 round-trip DB/kết quả, với maxItems=100 có thể thành 200+ query nối đuôi
    // nhau, đây là điểm chậm rõ nhất khi dùng tính năng tìm nhóm. Đổi sang: 1 findMany lấy
    // hết nhóm đã lưu trước đó, rồi upsert song song (Promise.all) — Prisma dịch upsert
    // trên Postgres thành 1 câu INSERT ... ON CONFLICT DO UPDATE nguyên tử nên chạy song
    // song cho CÙNG 1 khoá vẫn an toàn, không đụng độ.
    const itemsWithId = liveItems.filter((item): item is FacebookGroupItem & { id: string } => !!item.id);
    const existingByFbId = new Map(
      (
        await prisma.facebookGroup.findMany({
          where: { userId: session.user.id, fbId: { in: [...new Set(itemsWithId.map((i) => i.id))] } },
        })
      ).map((g) => [g.fbId, g])
    );

    // Gộp TẤT CẢ từ khóa khớp trong chính lượt tìm này theo từng fbId trước khi ghi DB —
    // 1 nhóm khớp nhiều từ khóa (multi-keyword) chỉ upsert đúng 1 lần với keywords[] đã
    // gộp đủ, tránh 2 lệnh upsert cùng fbId chạy song song ghi đè keywords[] của nhau (SET
    // nguyên mảng, không cộng dồn ở tầng SQL) — chỉ giữ lại từ khóa của lệnh chạy sau.
    const byFbId = new Map<string, { item: FacebookGroupItem; keywords: Set<string> }>();
    for (const item of itemsWithId) {
      const matchedKeyword = cacheKey(item.query ?? keywordsToSearch[0]);
      const counts = countsByKeyword.get(matchedKeyword);
      if (counts) {
        counts.resultCount += 1;
        if (!existingByFbId.has(item.id)) counts.newCount += 1;
      }

      const entry = byFbId.get(item.id);
      if (entry) {
        entry.keywords.add(matchedKeyword);
      } else {
        const merged = new Set(existingByFbId.get(item.id)?.keywords ?? []);
        merged.add(matchedKeyword);
        byFbId.set(item.id, { item, keywords: merged });
      }
    }

    const savedGroups = await Promise.all(
      [...byFbId.entries()].map(([fbId, { item, keywords }]) =>
        prisma.facebookGroup.upsert({
          where: { fbId_userId: { fbId, userId: session.user.id } },
          update: {
            name: item.name,
            url: item.url,
            visibility: item.visibility,
            memberCount: item.memberCount,
            postsPerDay: item.postsPerDay,
            description: item.description,
            keywords: [...keywords],
          },
          create: {
            userId: session.user.id,
            fbId,
            name: item.name,
            url: item.url,
            visibility: item.visibility,
            memberCount: item.memberCount,
            postsPerDay: item.postsPerDay,
            description: item.description,
            keywords: [...keywords],
          },
        })
      )
    );

    for (const saved of savedGroups) {
      resultItems.set(saved.fbId, {
        fbId: saved.fbId,
        name: saved.name,
        url: saved.url,
        visibility: saved.visibility,
        memberCount: saved.memberCount,
        postsPerDay: saved.postsPerDay,
        description: saved.description,
        matchedKeywords: saved.keywords,
        isNew: !existingByFbId.has(saved.fbId),
        fromCache: false,
      });
    }

    await prisma.facebookKeywordSearch.createMany({
      data: keywordsToSearch.map((keyword) => ({
        userId: session.user.id,
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
      where: { userId: session.user.id, keywords: { has: cacheKey(cached.keyword) } },
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

  // Lượt tìm phục vụ hoàn toàn từ cache không trừ tiền (charged/balanceAfter vẫn ở giá
  // trị mặc định) — vẫn lấy số dư hiện tại để hiển thị cho người bán biết còn bao nhiêu.
  if (!isSuperAdmin && balanceAfter === null) {
    const current = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { creditBalance: true },
    });
    balanceAfter = current?.creditBalance ?? 0;
  }

  return {
    ok: true,
    items: [...resultItems.values()],
    cachedKeywords,
    searchedKeywords: keywordsToSearch,
    charged,
    balanceAfter,
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

export type SavedFacebookGroupsPage = {
  items: SavedFacebookGroup[];
  totalCount: number;
  page: number;
  pageSize: number;
};

export async function listSavedFacebookGroups(
  query?: string,
  page: number = 1
): Promise<SavedFacebookGroupsPage> {
  const session = await requireAdmin();

  const trimmed = query?.trim();
  const where = {
    userId: session.user.id,
    ...(trimmed
      ? {
          OR: [
            { name: { contains: trimmed, mode: "insensitive" as const } },
            { keywords: { has: trimmed.toLowerCase() } },
          ],
        }
      : {}),
  };

  const safePage = Math.max(1, Math.trunc(page) || 1);

  const [groups, totalCount] = await Promise.all([
    prisma.facebookGroup.findMany({
      where,
      orderBy: { lastSeenAt: "desc" },
      skip: (safePage - 1) * SAVED_GROUPS_PAGE_SIZE,
      take: SAVED_GROUPS_PAGE_SIZE,
    }),
    prisma.facebookGroup.count({ where }),
  ]);

  return {
    items: groups.map((g) => ({
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
    })),
    totalCount,
    page: safePage,
    pageSize: SAVED_GROUPS_PAGE_SIZE,
  };
}
