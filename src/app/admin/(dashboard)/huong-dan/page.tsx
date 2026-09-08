import Link from "next/link";
import { requireAdmin } from "@/lib/admin-guard";
import { ADMIN_WIKI } from "@/lib/admin-wiki-content";

export default async function AdminWikiPage() {
  const session = await requireAdmin();
  const isSuperAdmin = session.user.role === "SUPERADMIN";
  const sections = ADMIN_WIKI.filter((section) => !section.superAdminOnly || isSuperAdmin);

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <div>
        <h1 className="font-heading text-lg font-bold text-text">Hướng dẫn sử dụng</h1>
        <p className="mt-1 text-sm text-neutral-700">
          Tổng hợp toàn bộ tính năng ở trang quản trị và công dụng của từng nút chính. Nội dung
          này giống hệt tour hướng dẫn hiện ra lúc đăng nhập lần đầu — xem lại bất cứ lúc nào ở đây.
        </p>
      </div>

      <nav className="flex flex-col gap-1 rounded-lg border border-neutral-200 p-4">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Mục lục</p>
        {sections.map((section) => (
          <div key={section.label} className="flex flex-col gap-0.5">
            <p className="mt-1 text-xs font-semibold text-neutral-500">{section.label}</p>
            {section.features.map((feature) => (
              <a key={feature.target} href={`#${feature.target}`} className="text-sm text-accent-600 underline">
                {feature.title}
              </a>
            ))}
          </div>
        ))}
      </nav>

      {sections.map((section) => (
        <div key={section.label} className="flex flex-col gap-4">
          <h2 className="font-heading text-base font-bold text-text">{section.label}</h2>
          {section.features.map((feature) => (
            <div key={feature.target} id={feature.target} className="rounded-lg border border-neutral-200 p-4 scroll-mt-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-heading text-sm font-bold text-text">{feature.title}</h3>
                <Link href={feature.href} className="shrink-0 text-xs text-accent-600 underline">
                  Đi tới trang này →
                </Link>
              </div>
              <p className="mt-1 text-sm text-neutral-700">{feature.description}</p>

              {feature.buttons && feature.buttons.length > 0 && (
                <ul className="mt-3 flex flex-col gap-2 border-t border-neutral-100 pt-3">
                  {feature.buttons.map((button) => (
                    <li key={button.target} className="text-sm">
                      <span className="font-medium text-text">{button.title}</span>{" "}
                      <span className="text-neutral-700">— {button.description}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
