import { BannerSlideshow } from "@/components/BannerSlideshow";
import { HeroSearchForm } from "@/components/HeroSearchForm";

export function HeroBanner({
  defaultQuery = "",
  bannerImages = [],
  bannerIntervalSeconds = 5,
}: {
  defaultQuery?: string;
  bannerImages?: string[];
  bannerIntervalSeconds?: number;
}) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-neutral-900 via-accent-700 to-accent-500">
      <BannerSlideshow images={bannerImages} intervalSeconds={bannerIntervalSeconds} />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-16 -top-24 h-72 w-72 rounded-full bg-accent-2-500/30 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-gold-400/30 blur-3xl"
      />

      <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-20 text-center sm:py-32">
        <h1 className="font-heading text-2xl font-bold text-white sm:text-4xl">
          Tìm sản phẩm thanh lý mẹ &amp; bé, thú cưng
        </h1>
        <p className="max-w-xl text-sm text-neutral-100 sm:text-base">
          Đấu giá minh bạch, trả giá bằng số điện thoại — không cần tạo tài khoản.
        </p>

        <HeroSearchForm defaultQuery={defaultQuery} />
      </div>
    </section>
  );
}
