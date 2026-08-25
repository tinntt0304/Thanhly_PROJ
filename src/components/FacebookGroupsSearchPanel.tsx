"use client";

import { useEffect, useState } from "react";
import {
  searchFacebookGroups,
  listSavedFacebookGroups,
  SAVED_GROUPS_PAGE_SIZE,
  type FacebookGroupsSearchResult,
  type FacebookGroupResultItem,
  type SavedFacebookGroup,
} from "@/lib/actions/facebook-groups";
import { DEFAULT_MAX_ITEMS, MAX_ITEMS_LIMIT, SEARCH_CACHE_HOURS } from "@/lib/facebook-groups";

const inputClass =
  "rounded-md border border-neutral-300 bg-surface px-3 py-2 text-sm text-text focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500";

function formatNumber(n: number | null): string {
  return n === null ? "—" : n.toLocaleString("vi-VN");
}

function formatRelativeHours(iso: string): string {
  const hours = Math.round((Date.now() - new Date(iso).getTime()) / 3600000);
  if (hours <= 0) return "vừa xong";
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.round(hours / 24)} ngày trước`;
}

function GroupTable({
  rows,
}: {
  rows: {
    fbId: string;
    name: string;
    url: string;
    description: string | null;
    keywordsLabel: string;
    memberCount: number | null;
    postsPerDay: number | null;
    visibility: string | null;
    badge?: { text: string; className: string };
  }[];
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-neutral-500">Không có nhóm nào.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-surface">
      <table className="w-full text-sm">
        <thead className="border-b border-neutral-200 bg-neutral-100 text-left text-xs uppercase text-neutral-700">
          <tr>
            <th className="px-4 py-2">Nhóm</th>
            <th className="px-4 py-2">Từ khóa</th>
            <th className="px-4 py-2">Thành viên</th>
            <th className="px-4 py-2">Bài đăng/ngày</th>
            <th className="px-4 py-2">Hiển thị</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {rows.map((g) => (
            <tr key={g.fbId}>
              <td className="max-w-xs px-4 py-2">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-text">{g.name}</p>
                  {g.badge && (
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${g.badge.className}`}>
                      {g.badge.text}
                    </span>
                  )}
                </div>
                {g.description && (
                  <p className="mt-0.5 line-clamp-2 text-xs text-neutral-500">{g.description}</p>
                )}
              </td>
              <td className="px-4 py-2 text-neutral-700">{g.keywordsLabel || "—"}</td>
              <td className="px-4 py-2 text-neutral-700">{formatNumber(g.memberCount)}</td>
              <td className="px-4 py-2 text-neutral-700">
                {g.postsPerDay === null ? "—" : g.postsPerDay.toLocaleString("vi-VN")}
              </td>
              <td className="px-4 py-2 text-neutral-700">{g.visibility ?? "—"}</td>
              <td className="px-4 py-2">
                {g.url && (
                  <a
                    href={g.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-600 underline"
                  >
                    Mở nhóm
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SearchTab() {
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Extract<FacebookGroupsSearchResult, { ok: true }> | null>(null);
  const [onlyNew, setOnlyNew] = useState(false);

  async function handleSubmit(formData: FormData) {
    setSearching(true);
    setError(null);
    try {
      const res = await searchFacebookGroups(formData);
      if (res.ok) {
        setResult(res);
        setOnlyNew(false);
      } else {
        setError(res.error);
        setResult(null);
      }
    } finally {
      setSearching(false);
    }
  }

  const items = result?.items ?? [];
  const visibleItems = onlyNew ? items.filter((i) => i.isNew) : items;
  const newCount = items.filter((i) => i.isNew).length;

  return (
    <div className="flex flex-col gap-6">
      {searching && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-lg bg-surface px-8 py-6 shadow-lg">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent-100 border-t-accent-500" />
            <p className="text-sm font-medium text-text">Đang tìm nhóm Facebook...</p>
            <p className="text-xs text-neutral-500">Có thể mất vài chục giây, vui lòng đợi.</p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-surface p-4">
        <p className="text-sm text-neutral-600">
          Dùng để tìm nhóm Facebook phù hợp mang sản phẩm sang chia sẻ. Dữ liệu lấy qua actor
          Apify (<code className="text-xs">scraper-engine/facebook-groups-search-scraper</code>),
          tốn credit Apify mỗi lần gọi thật. Từ khóa vừa tìm trong {SEARCH_CACHE_HOURS} giờ qua sẽ
          tự dùng lại kết quả đã lưu thay vì gọi lại API.
        </p>

        <form action={handleSubmit} className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-[240px] flex-1 flex-col gap-1">
            <label htmlFor="keywords" className="text-sm font-medium text-text">
              Từ khóa (cách nhau dấu phẩy nếu tìm nhiều từ)
            </label>
            <input
              id="keywords"
              name="keywords"
              placeholder="vd. đồ mẹ và bé, đồ sơ sinh"
              required
              className={inputClass}
            />
          </div>
          <div className="flex w-40 flex-col gap-1">
            <label htmlFor="maxItems" className="text-sm font-medium text-text">
              Số kết quả / từ khóa
            </label>
            <input
              id="maxItems"
              name="maxItems"
              type="number"
              min={1}
              max={MAX_ITEMS_LIMIT}
              defaultValue={DEFAULT_MAX_ITEMS}
              className={inputClass}
            />
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm text-neutral-700">
            <input type="checkbox" name="forceRefresh" className="h-4 w-4 rounded border-neutral-300" />
            Bắt buộc tìm lại (bỏ qua cache)
          </label>
          <button
            type="submit"
            disabled={searching}
            className="rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600 disabled:opacity-50"
          >
            {searching ? "Đang tìm..." : "Tìm kiếm"}
          </button>
        </form>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      {result && (
        <div className="flex flex-col gap-3">
          {result.cachedKeywords.length > 0 && (
            <div className="rounded-lg border border-gold-400/60 bg-gold-300/20 p-3 text-sm text-neutral-800">
              <p className="font-medium">Đã dùng lại kết quả cũ cho {result.cachedKeywords.length} từ khóa (không tốn credit):</p>
              <ul className="mt-1 list-disc pl-5">
                {result.cachedKeywords.map((c) => (
                  <li key={c.keyword}>
                    &ldquo;{c.keyword}&rdquo; — tìm {formatRelativeHours(c.searchedAt)} ({c.resultCount} kết quả,{" "}
                    {c.newCount} nhóm mới lúc đó)
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-neutral-700">
              Tổng <strong>{items.length}</strong> nhóm ({newCount} nhóm mới chưa từng thấy).
            </p>
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={onlyNew}
                onChange={(e) => setOnlyNew(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300"
              />
              Chỉ hiện nhóm mới
            </label>
          </div>

          <GroupTable
            rows={visibleItems.map((g: FacebookGroupResultItem) => ({
              fbId: g.fbId,
              name: g.name,
              url: g.url,
              description: g.description,
              keywordsLabel: g.matchedKeywords.join(", "),
              memberCount: g.memberCount,
              postsPerDay: g.postsPerDay,
              visibility: g.visibility,
              badge: g.isNew
                ? { text: "Mới", className: "bg-accent-2-100 text-accent-2-700" }
                : g.fromCache
                  ? { text: "Từ cache", className: "bg-neutral-100 text-neutral-600" }
                  : { text: "Đã biết", className: "bg-neutral-100 text-neutral-600" },
            }))}
          />
        </div>
      )}
    </div>
  );
}

function SavedTab() {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [groups, setGroups] = useState<SavedFacebookGroup[] | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listSavedFacebookGroups(query, page).then((res) => {
      if (!cancelled) {
        setGroups(res.items);
        setTotalCount(res.totalCount);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [query, page]);

  // setLoading(true) chạy ngay trong handler thay đổi ô lọc/trang (tương tác thật của
  // người dùng), không đặt trong effect — tránh lỗi lint react-hooks/set-state-in-effect
  // vì effect chỉ nên setState trong callback bất đồng bộ (đã làm ở trên).
  function handleQueryChange(value: string) {
    setLoading(true);
    setQuery(value);
    setPage(1); // đổi bộ lọc thì quay về trang 1, tránh trang hiện tại vượt quá số trang mới
  }

  function handlePageChange(next: number) {
    setLoading(true);
    setPage(next);
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / SAVED_GROUPS_PAGE_SIZE));

  return (
    <div className="flex flex-col gap-3">
      <input
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        placeholder="Lọc theo tên nhóm hoặc từ khóa..."
        className={inputClass}
      />
      {loading ? (
        <p className="text-sm text-neutral-500">Đang tải...</p>
      ) : (
        <>
          <p className="text-sm text-neutral-700">
            {totalCount} nhóm đã lưu — trang {page}/{totalPages}.
          </p>
          <GroupTable
            rows={(groups ?? []).map((g) => ({
              fbId: g.fbId,
              name: g.name,
              url: g.url,
              description: g.description,
              keywordsLabel: g.keywords.join(", "),
              memberCount: g.memberCount,
              postsPerDay: g.postsPerDay,
              visibility: g.visibility,
            }))}
          />
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ← Trang trước
              </button>
              <span className="text-sm text-neutral-700">
                Trang {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages}
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Trang sau →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function FacebookGroupsSearchPanel() {
  const [tab, setTab] = useState<"search" | "saved">("search");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-lg font-bold text-text">Tìm nhóm Facebook theo từ khóa</h1>

      <div className="flex gap-2 border-b border-neutral-200 text-sm">
        <button
          type="button"
          onClick={() => setTab("search")}
          className={`px-3 py-2 ${tab === "search" ? "border-b-2 border-accent-500 font-medium text-text" : "text-neutral-500"}`}
        >
          Tìm kiếm mới
        </button>
        <button
          type="button"
          onClick={() => setTab("saved")}
          className={`px-3 py-2 ${tab === "saved" ? "border-b-2 border-accent-500 font-medium text-text" : "text-neutral-500"}`}
        >
          Đã lưu
        </button>
      </div>

      {tab === "search" ? <SearchTab /> : <SavedTab />}
    </div>
  );
}
