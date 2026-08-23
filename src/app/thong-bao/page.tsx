import { prisma } from "@/lib/prisma";
import { SiteHeader } from "@/components/SiteHeader";

export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  const announcements = await prisma.announcement.findMany({
    where: { published: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="flex-1">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="font-heading text-xl font-bold text-text">Thông báo &amp; Tin tức</h1>

        {announcements.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-700">Chưa có thông báo nào.</p>
        ) : (
          <div className="mt-6 flex flex-col gap-4">
            {announcements.map((a) => (
              <article key={a.id} className="rounded-lg border border-neutral-200 bg-surface p-4">
                <h2 className="font-heading text-base font-bold text-text">{a.title}</h2>
                <p className="mt-1 text-xs text-neutral-500">
                  {a.createdAt.toLocaleDateString("vi-VN")}
                </p>
                <p className="mt-3 whitespace-pre-line text-sm text-neutral-800">{a.content}</p>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
