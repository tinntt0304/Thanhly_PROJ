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
          <ul className="flex flex-col gap-3">
            {orders.map((order) => (
              <li key={order.id} className="rounded-lg border border-neutral-200 bg-surface p-3 text-sm">
                <ul className="flex flex-col gap-1">
                  {order.items.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-2">
                      <span className="text-text">
                        {item.product.title}
                        {item.quantity > 1 && ` × ${item.quantity}`}
                      </span>
                      <span className="text-neutral-700">{formatVND(item.unitPrice * item.quantity)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex items-center justify-between border-t border-neutral-100 pt-2 font-medium text-text">
                  <span>Tổng</span>
                  <span>{formatVND(order.codAmount)}</span>
                </div>
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
