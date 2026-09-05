import { listMyOrders } from "@/lib/actions/buyer-orders";
import { getOrderTracking, isOrderCancellable, formatOrderCode } from "@/lib/orders";
import { SiteHeader } from "@/components/SiteHeader";
import { OrderTrackingSteps } from "@/components/OrderTrackingSteps";
import { BuyerOrderCancelButton } from "@/components/BuyerOrderCancelButton";
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
          <ul className="flex flex-col gap-3">
            {items.map((order) => (
              <li key={order.id} className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-surface p-4">
                <p className="font-mono text-xs text-neutral-500">{formatOrderCode(order.orderSeq)}</p>
                <div className="flex flex-col gap-1 text-sm">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-text">
                        {item.product.title}
                        {item.quantity > 1 && ` × ${item.quantity}`}
                      </span>
                      <span className="text-neutral-700">{formatVND(item.unitPrice * item.quantity)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-2 text-sm">
                  <p className="text-xs text-neutral-500">{formatDateTime(order.createdAt)}</p>
                  <span className="font-semibold text-text">Tổng: {formatVND(order.codAmount)}</span>
                </div>
                <OrderTrackingSteps tracking={getOrderTracking(order)} />
                {isOrderCancellable(order) && <BuyerOrderCancelButton orderId={order.id} />}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
