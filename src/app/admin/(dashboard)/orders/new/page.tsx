import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { createOrder } from "@/lib/actions/orders";
import { getWinningBid } from "@/lib/auction";
import { pickupAddressFromUser } from "@/lib/orders";
import { OrderForm } from "@/components/OrderForm";

export default async function NewOrderPage({ searchParams }: PageProps<"/admin/orders/new">) {
  const session = await requireAdmin();
  const { productId } = await searchParams;
  if (typeof productId !== "string" || !productId) notFound();

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { bids: { orderBy: { amount: "desc" } } },
  });
  if (!product) notFound();
  if (session.user.role !== "SUPERADMIN" && product.sellerId !== session.user.id) notFound();

  // GHN cần địa chỉ lấy hàng để tính phí/tạo vận đơn cho đơn sắp tạo — bắt buộc phải cấu hình
  // trước, chặn ngay ở đây (không chờ tới lúc bấm "Tạo vận đơn GHN" ở trang chi tiết đơn mới
  // báo lỗi), xem PickupAddressForm ở /admin/cai-dat.
  const sellerId = product.sellerId ?? session.user.id;
  const seller = await prisma.user.findUniqueOrThrow({ where: { id: sellerId } });
  if (!pickupAddressFromUser(seller)) {
    redirect("/admin/cai-dat?pickup_required=1");
  }

  const winningBid = getWinningBid(product.bids);
  const boundCreate = createOrder.bind(null, product.id);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-lg font-bold text-text">Tạo đơn hàng</h1>
        <p className="text-sm text-neutral-600">
          Cho sản phẩm: <span className="font-medium text-text">{product.title}</span>
        </p>
      </div>

      <OrderForm
        action={boundCreate}
        defaultBuyerPhone={winningBid?.phone}
        defaultCodAmount={product.currentPrice}
      />
    </div>
  );
}
