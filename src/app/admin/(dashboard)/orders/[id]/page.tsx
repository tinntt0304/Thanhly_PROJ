import { notFound } from "next/navigation";
import Link from "next/link";
import { getOrder, updateOrder } from "@/lib/actions/orders";
import { orderDisplayStatusLabel, getOrderFieldLocks } from "@/lib/orders";
import { ghnStatusLabel } from "@/lib/ghn";
import { formatVND, formatDateTime } from "@/lib/auction";
import { OrderActions } from "@/components/OrderActions";
import { OrderForm } from "@/components/OrderForm";

export default async function OrderDetailPage({ params }: PageProps<"/admin/orders/[id]">) {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();

  const boundUpdate = updateOrder.bind(null, order.id);
  const locks = getOrderFieldLocks(order.ghnStatus);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-lg font-bold text-text">Đơn hàng</h1>
        <span className="text-sm text-neutral-700">Trạng thái: {orderDisplayStatusLabel(order)}</span>
      </div>

      <p className="text-sm text-neutral-600">
        Sản phẩm:{" "}
        <Link href={`/admin/products/${order.product.id}`} className="font-medium text-accent-600 hover:underline">
          {order.product.title}
        </Link>{" "}
        · Tạo lúc: {formatDateTime(order.createdAt)}
      </p>

      <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-surface p-4">
        <h2 className="font-heading text-sm font-bold text-text">Thông tin đơn hàng</h2>
        {order.status === "CANCELLED" ? (
          <p className="text-sm text-neutral-600">Đơn đã huỷ, không sửa được nữa.</p>
        ) : (
          <>
            <p className="text-xs text-neutral-500">
              Sửa xong bấm &ldquo;Lưu thay đổi&rdquo; — nếu đơn đã có vận đơn GHN, hệ thống tự
              đồng bộ thay đổi sang GHN; GHN có thể từ chối nếu vận đơn đã qua giai đoạn cho
              phép sửa (đã lấy hàng trở đi), lúc đó sẽ hiện đúng lỗi từ GHN.
            </p>
            <OrderForm
              action={boundUpdate}
              submitLabel="Lưu thay đổi"
              pendingLabel="Đang lưu..."
              defaultBuyerName={order.buyerName}
              defaultBuyerPhone={order.buyerPhone}
              defaultBuyerAddress={order.buyerAddress}
              defaultProvinceId={order.provinceId}
              defaultProvinceName={order.provinceName}
              defaultDistrictId={order.districtId}
              defaultDistrictName={order.districtName}
              defaultWardCode={order.wardCode}
              defaultWardName={order.wardName}
              defaultCodAmount={order.codAmount}
              defaultWeightGram={order.weightGram}
              defaultLengthCm={order.lengthCm}
              defaultWidthCm={order.widthCm}
              defaultHeightCm={order.heightCm}
              defaultNote={order.note ?? undefined}
              defaultShopPaysShipping={order.shopPaysShipping}
              recipientLocked={locks.recipient}
              codLocked={locks.cod}
            />
          </>
        )}
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
