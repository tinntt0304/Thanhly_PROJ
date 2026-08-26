import { notFound } from "next/navigation";
import Link from "next/link";
import { getOrder } from "@/lib/actions/orders";
import { ORDER_STATUS_LABEL } from "@/lib/orders";
import { ghnStatusLabel } from "@/lib/ghn";
import { formatVND, formatDateTime } from "@/lib/auction";
import { OrderActions } from "@/components/OrderActions";

export default async function OrderDetailPage({ params }: PageProps<"/admin/orders/[id]">) {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-lg font-bold text-text">Đơn hàng</h1>
        <span className="text-sm text-neutral-700">Trạng thái: {ORDER_STATUS_LABEL[order.status]}</span>
      </div>

      <div className="flex flex-col gap-1 rounded-lg border border-neutral-200 bg-surface p-4 text-sm">
        <p>
          Sản phẩm:{" "}
          <Link href={`/admin/products/${order.product.id}`} className="font-medium text-accent-600 hover:underline">
            {order.product.title}
          </Link>
        </p>
        <p>
          Người nhận: <span className="font-medium text-text">{order.buyerName}</span> — {order.buyerPhone}
        </p>
        <p>
          Địa chỉ: {order.buyerAddress}, {order.wardName}, {order.districtName}, {order.provinceName}
        </p>
        <p>Tiền thu hộ (COD): {formatVND(order.codAmount)}</p>
        <p>
          Kích thước: {order.weightGram}g — {order.lengthCm}×{order.widthCm}×{order.heightCm}cm
        </p>
        <p>Người trả phí ship: {order.shopPaysShipping ? "Shop" : "Người mua"}</p>
        {order.note && <p>Ghi chú: {order.note}</p>}
        <p className="text-neutral-500">Tạo lúc: {formatDateTime(order.createdAt)}</p>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-surface p-4 text-sm">
        <h2 className="font-heading text-sm font-bold text-text">Vận chuyển GHN</h2>
        {order.ghnOrderCode ? (
          <>
            <p>
              Mã vận đơn: <span className="font-mono font-medium text-text">{order.ghnOrderCode}</span>
            </p>
            {order.ghnStatus && <p>Trạng thái GHN: {ghnStatusLabel(order.ghnStatus)}</p>}
            {order.shippingFee !== null && <p>Phí ship: {formatVND(order.shippingFee)}</p>}
            {order.expectedDeliveryAt && <p>Dự kiến giao: {formatDateTime(order.expectedDeliveryAt)}</p>}
          </>
        ) : (
          <p className="text-neutral-600">Chưa tạo vận đơn GHN.</p>
        )}
      </div>

      <OrderActions orderId={order.id} status={order.status} hasGhnOrderCode={!!order.ghnOrderCode} />
    </div>
  );
}
