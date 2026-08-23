import { prisma } from "@/lib/prisma";
import { SiteHeader } from "@/components/SiteHeader";

export const dynamic = "force-dynamic";

export default async function AboutPage() {
  const content = await prisma.siteContent.findUnique({ where: { key: "about_us" } });

  return (
    <main className="flex-1">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="font-heading text-xl font-bold text-text">Về chúng tôi</h1>
        <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-neutral-800">
          {content?.content ?? "Nội dung đang được cập nhật."}
        </p>
      </div>
    </main>
  );
}
