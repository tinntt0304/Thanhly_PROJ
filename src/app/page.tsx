import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { TrustBanner } from "@/components/TrustBanner";
import { ProductCard } from "@/components/ProductCard";
import { Logo } from "@/components/Logo";
import { getAuctionState } from "@/lib/auction";
import type { Review } from "@/lib/reviews";
import type { Product } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

function ProductGrid({
  items,
  emptyMessage,
}: {
  items: { product: Product; bidCount: number }[];
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

export default async function HomePage() {
  const [trustProfile, products] = await Promise.all([
    prisma.trustProfile.findFirst(),
    prisma.product.findMany({
      include: { _count: { select: { bids: true } } },
    }),
  ]);

  const activeProducts = products
    .filter((p) => getAuctionState(p, p._count.bids > 0) === "BIDDING")
    .sort((a, b) => a.endTime.getTime() - b.endTime.getTime())
    .map((product) => ({ product, bidCount: product._count.bids }));

  const endedProducts = products
    .filter((p) => getAuctionState(p, p._count.bids > 0) !== "BIDDING")
    .sort((a, b) => b.endTime.getTime() - a.endTime.getTime())
    .map((product) => ({ product, bidCount: product._count.bids }));

  return (
    <main className="flex-1">
      <header className="border-b border-neutral-200 bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Logo size="sm" />
          <Link href="/admin/login" className="text-sm text-neutral-700 hover:text-text">
            Người bán
          </Link>
        </div>
      </header>

      {trustProfile && (
        <TrustBanner
          avgRating={trustProfile.avgRating}
          soldCount={trustProfile.soldCount}
          reviews={(trustProfile.reviews as Review[]) ?? []}
        />
      )}

      <section className="mx-auto max-w-5xl px-4 py-8">
        <h2 className="mb-4 font-heading text-xl font-bold text-text">
          Sản phẩm đang thanh lý ({activeProducts.length})
        </h2>
        <ProductGrid items={activeProducts} emptyMessage="Chưa có sản phẩm nào đang thanh lý." />
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-8">
        <h2 className="mb-4 font-heading text-xl font-bold text-text">
          Sản phẩm đã kết thúc ({endedProducts.length})
        </h2>
        <ProductGrid items={endedProducts} emptyMessage="Chưa có sản phẩm nào kết thúc." />
      </section>
    </main>
  );
}
