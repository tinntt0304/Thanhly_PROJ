import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { TrustBanner } from "@/components/TrustBanner";
import { ProductCard } from "@/components/ProductCard";
import { Logo } from "@/components/Logo";
import type { Review } from "@/lib/reviews";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [trustProfile, products] = await Promise.all([
    prisma.trustProfile.findFirst(),
    prisma.product.findMany({
      orderBy: [{ status: "asc" }, { endTime: "asc" }],
      include: { _count: { select: { bids: true } } },
    }),
  ]);

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
        <h2 className="mb-4 font-heading text-xl font-bold text-text">Sản phẩm đang thanh lý</h2>
        {products.length === 0 ? (
          <p className="text-sm text-neutral-700">Chưa có sản phẩm nào được đăng.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} bidCount={product._count.bids} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
