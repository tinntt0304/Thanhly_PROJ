import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/admin-guard";
import { getPricePerResult, getMinTopUpAmount, getMaxTopUpAmount } from "@/lib/credits";
import { NavItemsManager } from "@/components/NavItemsManager";
import { AnnouncementsManager } from "@/components/AnnouncementsManager";
import { AboutContentEditor } from "@/components/AboutContentEditor";
import { BannerUploader } from "@/components/BannerUploader";
import { PricingConfigForm } from "@/components/PricingConfigForm";
import { TopUpLimitForm } from "@/components/TopUpLimitForm";
import { UserCreditsManager } from "@/components/UserCreditsManager";

export const dynamic = "force-dynamic";

export default async function ManageCategoriesPage() {
  await requireSuperAdmin();

  const [navItems, announcements, aboutContent, bannerConfig, pricePerResult, minTopUpAmount, maxTopUpAmount, users] =
    await Promise.all([
      prisma.navItem.findMany({ orderBy: { order: "asc" } }),
      prisma.announcement.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.siteContent.findUnique({ where: { key: "about_us" } }),
      // "home_banner" — phải khớp HOME_BANNER_KEY ở lib/actions/site-content.ts (không
      // import được hằng số từ file "use server", chỉ export được async function).
      prisma.homeBannerConfig.findUnique({ where: { key: "home_banner" } }),
      getPricePerResult(),
      getMinTopUpAmount(),
      getMaxTopUpAmount(),
      prisma.user.findMany({
        orderBy: { creditBalance: "desc" },
        select: { id: true, name: true, email: true, role: true, creditBalance: true },
      }),
    ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-lg font-bold text-text">Quản lý danh mục</h1>
        <p className="mt-1 text-sm text-neutral-700">
          Chỉ superadmin thấy trang này — quản lý menu điều hướng công khai, thông báo &amp;
          tin tức, nội dung trang &ldquo;Về chúng tôi&rdquo;, giá tìm nhóm Facebook, giới hạn
          nạp credit và số dư người dùng.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-base font-bold text-text">Menu điều hướng</h2>
        <NavItemsManager items={navItems} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-base font-bold text-text">Thông báo &amp; Tin tức</h2>
        <AnnouncementsManager
          items={announcements.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() }))}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-base font-bold text-text">Trang &ldquo;Về chúng tôi&rdquo;</h2>
        <AboutContentEditor content={aboutContent?.content ?? ""} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-base font-bold text-text">Banner trang chủ</h2>
        <BannerUploader
          currentImages={bannerConfig?.images ?? []}
          currentIntervalSeconds={bannerConfig?.intervalSeconds ?? 5}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-base font-bold text-text">Giá tìm nhóm Facebook</h2>
        <PricingConfigForm pricePerResult={pricePerResult} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-base font-bold text-text">Giới hạn nạp credit</h2>
        <TopUpLimitForm minTopUpAmount={minTopUpAmount} maxTopUpAmount={maxTopUpAmount} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-base font-bold text-text">Số dư credit người dùng</h2>
        <UserCreditsManager users={users} />
      </section>
    </div>
  );
}
