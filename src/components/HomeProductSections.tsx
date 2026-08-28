import { ProductCard } from "@/components/ProductCard";
import { matchesSearch } from "@/lib/search";
import type { AuctionState, HomeCardProduct } from "@/lib/auction";

type HomeProduct = { product: HomeCardProduct; bidCount: number; state: AuctionState };

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

// Không còn state/tương tác client (ô tìm kiếm thật nằm ở HeroBanner — submit GET /?q=...,
// đổi initialQuery qua URL) nên để component này chạy như Server Component, không cần "use
// client" — bớt JS gửi xuống trình duyệt.
export function HomeProductSections({
  products,
  initialQuery = "",
}: {
  products: HomeProduct[];
  initialQuery?: string;
}) {
  const query = initialQuery;
  const filtered = products.filter((p) => matchesSearch(p.product.title, query));

  const activeProducts = filtered
    .filter((p) => p.state === "BIDDING")
    .sort((a, b) => a.product.endTime.getTime() - b.product.endTime.getTime());

  const endedProducts = filtered
    .filter((p) => p.state !== "BIDDING")
    .sort((a, b) => b.product.endTime.getTime() - a.product.endTime.getTime());

  const isSearching = query.trim() !== "";

  return (
    <>
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
