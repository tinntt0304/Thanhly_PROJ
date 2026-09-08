import Link from "next/link";
import type { ComponentType } from "react";
import { requireAdmin } from "@/lib/admin-guard";
import { ADMIN_WIKI, type IconKey } from "@/lib/admin-wiki-content";
import {
  ProductsIcon,
  PlusIcon,
  ImportIcon,
  GalleryIcon,
  OrdersIcon,
  SearchIcon,
  MenuIcon,
  StarIcon,
  ChatIcon,
  UserIcon,
  InboxIcon,
} from "@/components/icons/AdminFeatureIcons";

const ICON_MAP: Record<IconKey, ComponentType<{ className?: string }>> = {
  products: ProductsIcon,
  plus: PlusIcon,
  import: ImportIcon,
  gallery: GalleryIcon,
  orders: OrdersIcon,
  search: SearchIcon,
  menu: MenuIcon,
  star: StarIcon,
  chat: ChatIcon,
  user: UserIcon,
  inbox: InboxIcon,
};

export default async function AdminWikiPage() {
  const session = await requireAdmin();
  const isSuperAdmin = session.user.role === "SUPERADMIN";
  const sections = ADMIN_WIKI.filter((section) => !section.superAdminOnly || isSuperAdmin);

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <div>
        <h1 className="font-heading text-lg font-bold text-text">Hướng dẫn sử dụng</h1>
        <p className="mt-1 text-sm text-neutral-700">
          Tổng hợp toàn bộ tính năng ở trang quản trị, các bước thao tác và công dụng của từng
          nút chính. Nội dung này đồng bộ với tour hướng dẫn hiện ra lúc đăng nhập lần đầu — xem
          lại bất cứ lúc nào ở đây.
        </p>
      </div>

      <nav className="flex flex-col gap-1 rounded-lg border border-neutral-200 p-4">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Mục lục</p>
        {sections.map((section) => (
          <div key={section.label} className="flex flex-col gap-0.5">
            <p className="mt-1 text-xs font-semibold text-neutral-500">{section.label}</p>
            {section.features.map((feature) => {
              const Icon = ICON_MAP[feature.icon];
              return (
                <a
                  key={feature.target}
                  href={`#${feature.target}`}
                  className="flex items-center gap-1.5 text-sm text-accent-600 underline"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {feature.title}
                </a>
              );
            })}
          </div>
        ))}
      </nav>

      {sections.map((section) => (
        <div key={section.label} className="flex flex-col gap-4">
          <h2 className="font-heading text-base font-bold text-text">{section.label}</h2>
          {section.features.map((feature) => {
            const Icon = ICON_MAP[feature.icon];
            return (
              <div
                key={feature.target}
                id={feature.target}
                className="scroll-mt-4 rounded-lg border border-neutral-200 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-100 text-accent-700">
                      <Icon className="h-4 w-4" />
                    </span>
                    <h3 className="font-heading text-sm font-bold text-text">{feature.title}</h3>
                  </div>
                  <Link href={feature.href} className="shrink-0 text-xs text-accent-600 underline">
                    Đi tới trang này →
                  </Link>
                </div>
                <p className="mt-2 text-sm text-neutral-700">{feature.description}</p>

                {feature.steps && feature.steps.length > 0 && (
                  <ol className="mt-3 flex flex-col gap-2 border-t border-neutral-100 pt-3">
                    {feature.steps.map((stepText, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-500 text-xs font-semibold text-white">
                          {i + 1}
                        </span>
                        <span className="text-neutral-700">{stepText}</span>
                      </li>
                    ))}
                  </ol>
                )}

                {feature.buttons && feature.buttons.length > 0 && (
                  <div className="mt-3 border-t border-neutral-100 pt-3">
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Các nút chính
                    </p>
                    <ul className="flex flex-col gap-1.5">
                      {feature.buttons.map((button) => (
                        <li key={button.target} className="text-sm">
                          <span className="font-medium text-text">{button.title}</span>{" "}
                          <span className="text-neutral-700">— {button.description}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
