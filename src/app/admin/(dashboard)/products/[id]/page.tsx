import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { updateProduct, setProductStatus } from "@/lib/actions/products";
import { ProductForm } from "@/components/ProductForm";
import { PRODUCT_STATUS_LABEL, formatDateTime, formatVND } from "@/lib/auction";

export default async function EditProductPage({
  params,
}: PageProps<"/admin/products/[id]">) {
  const session = await requireAdmin();
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    include: { bids: { orderBy: { amount: "desc" } } },
  });
  if (!product) notFound();
  if (session.user.role !== "SUPERADMIN" && product.sellerId !== session.user.id) notFound();

  const boundUpdate = updateProduct.bind(null, product.id);
  const markSold = setProductStatus.bind(null, product.id, "SOLD");
  const markCancelled = setProductStatus.bind(null, product.id, "CANCELLED");
  const markActive = setProductStatus.bind(null, product.id, "ACTIVE");

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-lg font-bold text-text">Sửa sản phẩm</h1>
        <span className="text-sm text-neutral-700">
          Trạng thái: {PRODUCT_STATUS_LABEL[product.status]}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {product.status !== "SOLD" && (
          <form action={markSold}>
            <button className="flex items-center gap-1.5 whitespace-nowrap rounded-md border border-accent-2-300 bg-accent-2-100/50 px-3 py-1.5 text-sm font-medium text-accent-2-700 transition-colors hover:bg-accent-2-100">
              <span aria-hidden="true">✓</span> Đánh dấu đã bán
            </button>
          </form>
        )}
        {product.status !== "CANCELLED" && (
          <form action={markCancelled}>
            <button className="flex items-center gap-1.5 whitespace-nowrap rounded-md border border-red-200 bg-red-50/50 px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50">
              <span aria-hidden="true">✕</span> Huỷ sản phẩm
            </button>
          </form>
        )}
        {product.status !== "ACTIVE" && (
          <form action={markActive}>
            <button className="flex items-center gap-1.5 whitespace-nowrap rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100">
              <span aria-hidden="true">↺</span> Mở lại đấu giá
            </button>
          </form>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-heading text-sm font-bold text-text">
          Lịch sử trả giá ({product.bids.length}) — SĐT đầy đủ
        </h2>
        {product.bids.length === 0 ? (
          <p className="text-sm text-neutral-700">Chưa có ai trả giá cho sản phẩm này.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-surface">
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-100 text-left text-xs uppercase text-neutral-700">
                <tr>
                  <th className="px-4 py-2">SĐT</th>
                  <th className="px-4 py-2">Mức giá</th>
                  <th className="px-4 py-2">Thời gian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {product.bids.map((bid, i) => (
                  <tr key={bid.id} className={i === 0 ? "bg-accent-100/50" : undefined}>
                    <td className="px-4 py-2 font-medium text-text">
                      {bid.phone}
                      {i === 0 && (
                        <span className="ml-2 text-xs font-normal text-accent-700">
                          cao nhất
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">{formatVND(bid.amount)}</td>
                    <td className="px-4 py-2 text-neutral-700">{formatDateTime(bid.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ProductForm action={boundUpdate} product={product} submitLabel="Lưu thay đổi" />
    </div>
  );
}
