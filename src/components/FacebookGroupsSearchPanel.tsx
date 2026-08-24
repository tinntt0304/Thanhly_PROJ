"use client";

import { useState } from "react";
import {
  searchFacebookGroups,
  type FacebookGroupsSearchResult,
} from "@/lib/actions/facebook-groups";
import { DEFAULT_MAX_ITEMS, MAX_ITEMS_LIMIT, type FacebookGroupItem } from "@/lib/facebook-groups";

const inputClass =
  "rounded-md border border-neutral-300 bg-surface px-3 py-2 text-sm text-text focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500";

function formatNumber(n: number | null): string {
  return n === null ? "—" : n.toLocaleString("vi-VN");
}

export function FacebookGroupsSearchPanel() {
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<FacebookGroupItem[] | null>(null);

  async function handleSubmit(formData: FormData) {
    setSearching(true);
    setError(null);
    try {
      const res: FacebookGroupsSearchResult = await searchFacebookGroups(formData);
      if (res.ok) {
        setItems(res.items);
      } else {
        setError(res.error);
        setItems(null);
      }
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-surface p-4">
        <div>
          <h1 className="font-heading text-lg font-bold text-text">Tìm nhóm Facebook theo từ khóa</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Dùng để tìm nhóm Facebook phù hợp mang sản phẩm sang chia sẻ. Dữ liệu lấy qua actor
            Apify (<code className="text-xs">scraper-engine/facebook-groups-search-scraper</code>),
            tốn credit Apify mỗi lần tìm.
          </p>
        </div>

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

      {items && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-neutral-700">
            Tìm thấy <strong>{items.length}</strong> nhóm.
          </p>

          {items.length === 0 ? (
            <p className="text-sm text-neutral-500">Không tìm thấy nhóm nào khớp từ khóa.</p>
          ) : (
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
                  {items.map((g, i) => (
                    <tr key={g.id || `${g.url}-${i}`}>
                      <td className="max-w-xs px-4 py-2">
                        <p className="font-medium text-text">{g.name}</p>
                        {g.description && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-neutral-500">
                            {g.description}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-2 text-neutral-700">{g.query ?? "—"}</td>
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
          )}
        </div>
      )}
    </div>
  );
}
