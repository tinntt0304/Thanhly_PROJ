import Link from "next/link";
import { requireAdmin } from "@/lib/admin-guard";
import { getMyOrders } from "@/lib/actions/buyer-orders";
import { SiteHeader } from "@/components/SiteHeader";
import { formatVND } from "@/lib/auction";

export const dynamic = "force-dynamic";

export default async function CartCheckoutSuccessPage({
  searchParams,
}: PageProps<"/gio-hang/thanh-cong">) {
  await requireAdmin();
  const { orders: ordersParam } = await searchParams;
  const orderIds =
    typeof ordersParam === "string" ? ordersParam.split(",").filter(Boolean) : [];
  const orders = await getMyOrders(orderIds);

  return (
    <main className="flex-1">
      <SiteHeader />
      <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
        <div className="rounded-lg border border-accent-2-300 bg-accent-2-100 p-4 text-sm text-accent-2-700">
          Đặt hàng thành công! Người bán sẽ sớm liên hệ để xác nhận và giao hàng.
        </div>

        {orders.length > 0 && (
          <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-surface">
            {orders.map((order) => (
              <li key={order.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                <span className="text-text">{order.product.title}</span>
                <span className="font-medium text-text">{formatVND(order.codAmount)}</span>
              </li>
            ))}
          </ul>
        )}

        <Link href="/tai-khoan/don-hang" className="text-sm text-accent-600 underline">
          Xem lịch sử đơn hàng →
        </Link>
      </div>
    </main>
  );
}
