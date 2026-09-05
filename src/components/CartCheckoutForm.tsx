"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { removeFromCart, checkoutCart, updateCartItemQuantity, type CheckoutCartState } from "@/lib/actions/cart";
import { BuyerShippingFields } from "@/components/BuyerShippingFields";
import { formatVND } from "@/lib/auction";
import { isOptimizableProductImage } from "@/lib/image-url";

const initialState: CheckoutCartState | undefined = undefined;

export type CartItemView = {
  productId: string;
  title: string;
  image: string | null;
  buyNowPrice: number | null;
  quantity: number; // số lượng buyer đang muốn mua, đã kẹp trong [1, stock]
  stock: number; // số lượng thật còn lại của sản phẩm — trần cho ô nhập số lượng
  available: boolean; // false nếu sản phẩm đã hết hàng/đã bán/đã huỷ kể từ lúc thêm vào giỏ
};

export function CartCheckoutForm({
  items,
  defaultName,
  defaultPhone,
}: {
  items: CartItemView[];
  defaultName?: string;
  defaultPhone?: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(checkoutCart, initialState);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, number>>({});
  const [quantityErrors, setQuantityErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (state?.ok) {
      router.push(`/gio-hang/thanh-cong?orders=${state.orderIds.join(",")}`);
    }
  }, [state, router]);

  async function handleRemove(productId: string) {
    setRemovingId(productId);
    await removeFromCart(productId);
    setRemovingId(null);
    router.refresh();
  }

  async function handleQuantityChange(productId: string, value: number) {
    setQuantityDrafts((prev) => ({ ...prev, [productId]: value }));
  }

  async function handleQuantityCommit(productId: string, value: number) {
    setUpdatingId(productId);
    setQuantityErrors((prev) => ({ ...prev, [productId]: "" }));
    const res = await updateCartItemQuantity(productId, value);
    setUpdatingId(null);
    if (!res.ok) {
      setQuantityErrors((prev) => ({ ...prev, [productId]: res.error }));
      return;
    }
    setQuantityDrafts((prev) => ({ ...prev, [productId]: res.quantity }));
    router.refresh();
  }

  if (items.length === 0) {
    return <p className="text-sm text-neutral-700">Giỏ hàng đang trống.</p>;
  }

  const hasUnavailable = items.some((i) => !i.available);
  const total = items
    .filter((i) => i.available)
    .reduce((sum, i) => sum + (i.buyNowPrice ?? 0) * (quantityDrafts[i.productId] ?? i.quantity), 0);

  return (
    <div className="flex flex-col gap-4">
      <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-surface">
        {items.map((item) => (
          <li key={item.productId} className="flex items-center gap-3 p-3">
            {item.image ? (
              <Image
                src={item.image}
                alt={item.title}
                width={56}
                height={56}
                unoptimized={!isOptimizableProductImage(item.image)}
                className="h-14 w-14 rounded-md object-cover"
              />
            ) : (
              <div className="h-14 w-14 rounded-md bg-neutral-100" />
            )}
            <div className="flex-1">
              <p className="text-sm font-medium text-text">{item.title}</p>
              {item.available ? (
                <>
                  <p className="text-sm text-neutral-700">{formatVND(item.buyNowPrice ?? 0)}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <label htmlFor={`qty-${item.productId}`} className="text-xs text-neutral-500">
                      Số lượng (tối đa {item.stock}):
                    </label>
                    <input
                      id={`qty-${item.productId}`}
                      type="number"
                      min={1}
                      max={item.stock}
                      value={quantityDrafts[item.productId] ?? item.quantity}
                      onChange={(e) => handleQuantityChange(item.productId, Number(e.target.value))}
                      onBlur={(e) => handleQuantityCommit(item.productId, Number(e.target.value))}
                      disabled={updatingId === item.productId}
                      className="w-16 rounded-md border border-neutral-300 px-2 py-1 text-sm text-text focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500 disabled:opacity-50"
                    />
                  </div>
                  {quantityErrors[item.productId] && (
                    <p className="mt-0.5 text-xs text-red-600">{quantityErrors[item.productId]}</p>
                  )}
                </>
              ) : (
                <p className="text-sm font-medium text-red-600">Hết hàng / đã bán — vui lòng xoá khỏi giỏ</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => handleRemove(item.productId)}
              disabled={removingId === item.productId}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
            >
              {removingId === item.productId ? "Đang xoá..." : "Xoá"}
            </button>
          </li>
        ))}
      </ul>

      <p className="text-sm text-neutral-700">
        Tổng tạm tính: <span className="font-semibold text-text">{formatVND(total)}</span>
      </p>

      {hasUnavailable ? (
        <p className="text-sm text-red-600">
          Có sản phẩm đã hết hàng/đã bán trong giỏ — vui lòng xoá trước khi đặt hàng.
        </p>
      ) : (
        <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-surface p-4">
          <h3 className="font-heading text-sm font-bold text-text">Thông tin nhận hàng</h3>
          <BuyerShippingFields idPrefix="cart" defaultName={defaultName} defaultPhone={defaultPhone} />
          {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="self-start rounded-md bg-accent-2-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-2-700 disabled:opacity-50"
          >
            {pending ? "Đang đặt hàng..." : "Đặt hàng"}
          </button>
        </form>
      )}
    </div>
  );
}
