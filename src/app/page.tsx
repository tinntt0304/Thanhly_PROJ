import { prisma } from "@/lib/prisma";
import { TrustBanner } from "@/components/TrustBanner";
import { HomeProductSections } from "@/components/HomeProductSections";
import { SiteHeader } from "@/components/SiteHeader";
import { HeroBanner } from "@/components/HeroBanner";
import { getAuctionState } from "@/lib/auction";
import { ChatWidget } from "@/components/ChatWidget";
import type { Review } from "@/lib/reviews";

// KHÔNG filter theo status ở đây dù chỉ ACTIVE mới cần cho phần "đang thanh lý" — phần
// "đã kết thúc" (ProductGrid thứ 2 ở HomeProductSections) cố ý hiển thị CẢ sản phẩm
// SOLD/CANCELLED làm minh bạch lịch sử giao dịch, nên vẫn cần lấy mọi trạng thái. Chỉ bớt
// field không dùng tới ở card (description, attributes JSON...) qua `select`.
export default async function HomePage({ searchParams }: PageProps<"/">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q : "";

  const [trustProfile, bannerConfig, products] = await Promise.all([
    prisma.trustProfile.findFirst(),
    // "home_banner" — phải khớp HOME_BANNER_KEY ở lib/actions/site-content.ts (không import
    // được hằng số từ file "use server", chỉ export được async function).
    prisma.homeBannerConfig.findUnique({ where: { key: "home_banner" } }),
    prisma.product.findMany({
      select: {
        id: true,
        title: true,
        images: true,
        tags: true,
        currentPrice: true,
        endTime: true,
        status: true,
        _count: { select: { bids: true } },
      },
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
      <HeroBanner
        defaultQuery={query}
        bannerImages={bannerConfig?.images ?? []}
        bannerIntervalSeconds={bannerConfig?.intervalSeconds ?? 5}
      />

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
