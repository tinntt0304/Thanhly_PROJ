import { requireAdmin } from "@/lib/admin-guard";
import { FacebookGroupsSearchPanel } from "@/components/FacebookGroupsSearchPanel";

export default async function FacebookGroupsPage() {
  await requireAdmin();
  return <FacebookGroupsSearchPanel />;
}
