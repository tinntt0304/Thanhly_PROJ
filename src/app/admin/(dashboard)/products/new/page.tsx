import { createProduct } from "@/lib/actions/products";
import { ProductForm } from "@/components/ProductForm";

export default function NewProductPage() {
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-lg font-semibold">Đăng sản phẩm mới</h1>
      <ProductForm action={createProduct} submitLabel="Đăng sản phẩm" />
    </div>
  );
}
