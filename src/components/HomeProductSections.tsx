"use client";

import { useMemo, useState } from "react";
import { ProductCard } from "@/components/ProductCard";
import { matchesSearch } from "@/lib/search";
import type { AuctionState } from "@/lib/auction";
import type { Product } from "@/generated/prisma/client";

type HomeProduct = { product: Product; bidCount: number; state: AuctionState };

function ProductGrid({
  items,
  emptyMessage,
}: {
  items: HomeProduct[];
  emptyMessage: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-neutral-700">{emptyMessage}</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
      {items.map(({ product, bidCount }) => (
        <ProductCard key={product.id} product={product} bidCount={bidCount} />
      ))}
    </div>
  );
}

export function HomeProductSections({
  products,
  initialQuery = "",
}: {
  products: HomeProduct[];
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);

  const filtered = useMemo(
    () => products.filter((p) => matchesSearch(p.product.title, query)),
    [products, query]
  );

  const activeProducts = useMemo(
    () =>
      filtered
        .filter((p) => p.state === "BIDDING")
        .sort((a, b) => a.product.endTime.getTime() - b.product.endTime.getTime()),
    [filtered]
  );

  const endedProducts = useMemo(
    () =>
      filtered
        .filter((p) => p.state !== "BIDDING")
        .sort((a, b) => b.product.endTime.getTime() - a.product.endTime.getTime()),
    [filtered]
  );

  const isSearching = query.trim() !== "";

  return (
    <>
      <div className="relative mb-6">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm sản phẩm theo tên..."
          aria-label="Tìm sản phẩm"
          className="w-full rounded-md border border-neutral-300 bg-surface px-4 py-2.5 pl-10 text-sm text-text placeholder:text-neutral-500 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
        />
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
        </svg>
      </div>

      {isSearching && filtered.length === 0 ? (
        <p className="text-sm text-neutral-700">
          Không tìm thấy sản phẩm nào khớp với &ldquo;{query.trim()}&rdquo;.
        </p>
      ) : (
        <div className="flex flex-col gap-8">
          <section>
            <h2 className="mb-4 font-heading text-xl font-bold text-text">
              Sản phẩm đang thanh lý ({activeProducts.length})
            </h2>
            <ProductGrid
              items={activeProducts}
              emptyMessage={
                isSearching
                  ? "Không có sản phẩm đang thanh lý khớp tìm kiếm."
                  : "Chưa có sản phẩm nào đang thanh lý."
              }
            />
          </section>

          <section>
            <h2 className="mb-4 font-heading text-xl font-bold text-text">
              Sản phẩm đã kết thúc ({endedProducts.length})
            </h2>
            <ProductGrid
              items={endedProducts}
              emptyMessage={
                isSearching
                  ? "Không có sản phẩm đã kết thúc khớp tìm kiếm."
                  : "Chưa có sản phẩm nào kết thúc."
              }
            />
          </section>
        </div>
      )}
    </>
  );
}
