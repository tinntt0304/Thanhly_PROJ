import { requireAdmin } from "@/lib/admin-guard";
import { getPricePerResult } from "@/lib/credits";
import { FacebookGroupsSearchPanel } from "@/components/FacebookGroupsSearchPanel";

export default async function FacebookGroupsPage() {
  const session = await requireAdmin();
  const isSuperAdmin = session.user.role === "SUPERADMIN";
  const pricePerResult = await getPricePerResult();
  return <FacebookGroupsSearchPanel pricePerResult={pricePerResult} isSuperAdmin={isSuperAdmin} />;
}
