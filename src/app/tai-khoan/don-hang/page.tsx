import { listMyOrders } from "@/lib/actions/buyer-orders";
import { orderDisplayStatusLabel } from "@/lib/orders";
import { SiteHeader } from "@/components/SiteHeader";
import { formatDateTime, formatVND } from "@/lib/auction";

export const dynamic = "force-dynamic";

export default async function BuyerOrderHistoryPage() {
  const { items } = await listMyOrders();

  return (
    <main className="flex-1">
      <SiteHeader />
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
        <h1 className="font-heading text-lg font-bold text-text">Đơn hàng của tôi ({items.length})</h1>

        {items.length === 0 ? (
          <p className="text-sm text-neutral-700">Bạn chưa có đơn hàng nào.</p>
        ) : (
          <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-surface">
            {items.map((order) => (
              <li key={order.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <div>
                  <p className="font-medium text-text">{order.product.title}</p>
                  <p className="text-xs text-neutral-500">{formatDateTime(order.createdAt)}</p>
                </div>
                <span className="font-medium text-text">{formatVND(order.codAmount)}</span>
                <span className="rounded-full bg-accent-100 px-3 py-1 text-xs font-semibold text-accent-700">
                  {orderDisplayStatusLabel(order)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
