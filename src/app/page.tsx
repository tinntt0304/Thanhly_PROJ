import { prisma } from "@/lib/prisma";
import { TrustBanner } from "@/components/TrustBanner";
import { HomeProductSections } from "@/components/HomeProductSections";
import { SiteHeader } from "@/components/SiteHeader";
import { HeroBanner } from "@/components/HeroBanner";
import { getAuctionState } from "@/lib/auction";
import { ChatWidget } from "@/components/ChatWidget";
import type { Review } from "@/lib/reviews";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q : "";

  const [trustProfile, products] = await Promise.all([
    prisma.trustProfile.findFirst(),
    prisma.product.findMany({
      include: { _count: { select: { bids: true } } },
    }),
  ]);

  const homeProducts = products.map((product) => ({
    product,
    bidCount: product._count.bids,
    state: getAuctionState(product, product._count.bids > 0),
  }));

  return (
    <main className="flex-1">
      <SiteHeader />
      <HeroBanner defaultQuery={query} />

      {trustProfile && (
        <TrustBanner
          avgRating={trustProfile.avgRating}
          soldCount={trustProfile.soldCount}
          reviews={(trustProfile.reviews as Review[]) ?? []}
        />
      )}

      <section className="mx-auto max-w-5xl px-4 py-8">
        {products.length === 0 ? (
          <>
            <h2 className="mb-4 font-heading text-xl font-bold text-text">
              Sản phẩm đang thanh lý
            </h2>
            <p className="text-sm text-neutral-700">Chưa có sản phẩm nào được đăng.</p>
          </>
        ) : (
          <HomeProductSections products={homeProducts} initialQuery={query} />
        )}
      </section>

      <ChatWidget />
    </main>
  );
}
