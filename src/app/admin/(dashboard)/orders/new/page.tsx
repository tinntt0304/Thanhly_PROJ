import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { createOrder } from "@/lib/actions/orders";
import { getWinningBid } from "@/lib/auction";
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
