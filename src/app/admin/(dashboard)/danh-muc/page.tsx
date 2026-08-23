import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/admin-guard";
import { NavItemsManager } from "@/components/NavItemsManager";
import { AnnouncementsManager } from "@/components/AnnouncementsManager";
import { AboutContentEditor } from "@/components/AboutContentEditor";

export const dynamic = "force-dynamic";

export default async function ManageCategoriesPage() {
  await requireSuperAdmin();

  const [navItems, announcements, aboutContent] = await Promise.all([
    prisma.navItem.findMany({ orderBy: { order: "asc" } }),
    prisma.announcement.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.siteContent.findUnique({ where: { key: "about_us" } }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-lg font-bold text-text">Quản lý danh mục</h1>
        <p className="mt-1 text-sm text-neutral-700">
          Chỉ superadmin thấy trang này — quản lý menu điều hướng công khai, thông báo &amp;
          tin tức, và nội dung trang &ldquo;Về chúng tôi&rdquo;.
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
    </div>
  );
}
