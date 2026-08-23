import { prisma } from "@/lib/prisma";

export type NavLink = { label: string; href: string };

// "Trang chủ" luôn cố định đứng đầu, không lưu trong bảng NavItem — tránh để superadmin
// lỡ tay xoá mất link về trang chủ.
export const HOME_NAV_LINK: NavLink = { label: "Trang chủ", href: "/" };

export async function getNavLinks(): Promise<NavLink[]> {
  const items = await prisma.navItem.findMany({ orderBy: { order: "asc" } });
  return [HOME_NAV_LINK, ...items.map((i) => ({ label: i.label, href: i.href }))];
}
