import { requireAdmin } from "@/lib/admin-guard";
import { getCreditBalance, getMinTopUpAmount, getMaxTopUpAmount } from "@/lib/credits";
import { getActivePendingTopUp } from "@/lib/actions/credits";
import { TopUpCreditPanel } from "@/components/TopUpCreditPanel";

export default async function TopUpCreditPage() {
  const session = await requireAdmin();
  const [balance, minTopUpAmount, maxTopUpAmount, pendingTopUp] = await Promise.all([
    getCreditBalance(session.user.id),
    getMinTopUpAmount(),
    getMaxTopUpAmount(),
    getActivePendingTopUp(),
  ]);

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <h1 className="font-heading text-lg font-bold text-text">Nạp credit</h1>
      <TopUpCreditPanel
        initialBalance={balance}
        minTopUpAmount={minTopUpAmount}
        maxTopUpAmount={maxTopUpAmount}
        initialPending={pendingTopUp}
      />
    </div>
  );
}
