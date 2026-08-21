import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateProduct, setProductStatus } from "@/lib/actions/products";
import { ProductForm } from "@/components/ProductForm";
import { PRODUCT_STATUS_LABEL } from "@/lib/auction";

export default async function EditProductPage({
  params,
}: PageProps<"/admin/products/[id]">) {
  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) notFound();

  const boundUpdate = updateProduct.bind(null, product.id);
  const markSold = setProductStatus.bind(null, product.id, "SOLD");
  const markCancelled = setProductStatus.bind(null, product.id, "CANCELLED");
  const markActive = setProductStatus.bind(null, product.id, "ACTIVE");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-lg font-bold text-text">Sửa sản phẩm</h1>
        <span className="text-sm text-neutral-700">
          Trạng thái: {PRODUCT_STATUS_LABEL[product.status]}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {product.status !== "SOLD" && (
          <form action={markSold}>
            <button className="rounded-md border border-accent-2-300 px-3 py-1.5 text-sm text-accent-2-700 hover:bg-accent-2-100">
              Đánh dấu đã bán
            </button>
          </form>
        )}
        {product.status !== "CANCELLED" && (
          <form action={markCancelled}>
            <button className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50">
              Huỷ sản phẩm
            </button>
          </form>
        )}
        {product.status !== "ACTIVE" && (
          <form action={markActive}>
            <button className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">
              Mở lại đấu giá
            </button>
          </form>
        )}
      </div>

      <ProductForm action={boundUpdate} product={product} submitLabel="Lưu thay đổi" />
    </div>
  );
}
