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
  sellerId: string; // dùng để gom nhóm hiển thị theo "shop", giống Shopee tách đơn theo người bán
  sellerName: string;
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
  // Mặc định tick sẵn mọi sản phẩm còn mua được — sản phẩm hết hàng/đã bán không chọn được,
  // không còn chặn cả giỏ như trước (xem checkoutCart ở actions/cart.ts: chỉ đặt hàng đúng
  // những sản phẩm được tick, món khác vẫn nằm nguyên trong giỏ).
  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.map((i) => [i.productId, i.available]))
  );
  // Đồng bộ lại khi danh sách items đổi (xoá món/đổi số lượng khiến server component render
  // lại với mảng items mới) — giữ nguyên lựa chọn cũ cho món còn tồn tại, món mới mặc định
  // tick. Tính lại NGAY TRONG RENDER (không dùng useEffect) theo pattern "adjust state while
  // rendering" của React — tránh 1 lượt render thừa với state cũ trước khi effect kịp chạy.
  const itemsKey = items.map((i) => i.productId).join("|");
  const [syncedItemsKey, setSyncedItemsKey] = useState(itemsKey);
  if (itemsKey !== syncedItemsKey) {
    setSyncedItemsKey(itemsKey);
    setSelected((prev) => {
      const next: Record<string, boolean> = {};
      for (const item of items) {
        next[item.productId] = item.productId in prev ? prev[item.productId] && item.available : item.available;
      }
      return next;
    });
  }

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

  // Báo lỗi NGAY khi gõ vượt tồn kho, không cần chờ blur/gọi server mới biết — server (xem
  // updateCartItemQuantity) vẫn tự kẹp lại khi lưu nên đây chỉ là phản hồi tức thời cho buyer.
  function handleQuantityChange(productId: string, value: number, stock: number) {
    setQuantityDrafts((prev) => ({ ...prev, [productId]: value }));
    if (value > stock) {
      setQuantityErrors((prev) => ({ ...prev, [productId]: `Chỉ còn tối đa ${stock} sản phẩm trong kho.` }));
    } else if (value < 1) {
      setQuantityErrors((prev) => ({ ...prev, [productId]: "Số lượng tối thiểu là 1." }));
    } else {
      setQuantityErrors((prev) => ({ ...prev, [productId]: "" }));
    }
  }

  async function handleQuantityCommit(productId: string, value: number) {
    setUpdatingId(productId);
    const res = await updateCartItemQuantity(productId, value);
    setUpdatingId(null);
    if (!res.ok) {
      setQuantityErrors((prev) => ({ ...prev, [productId]: res.error }));
      return;
    }
    setQuantityDrafts((prev) => ({ ...prev, [productId]: res.quantity }));
    setQuantityErrors((prev) => ({ ...prev, [productId]: res.warning ?? "" }));
    router.refresh();
  }

  // Bấm nút +/- ở bộ đếm — kẹp ngay trong [1, stock] rồi lưu luôn, không cần đợi blur ô nhập.
  function handleStep(productId: string, nextValue: number, stock: number) {
    const clamped = Math.min(Math.max(nextValue, 1), Math.max(stock, 1));
    setQuantityDrafts((prev) => ({ ...prev, [productId]: clamped }));
    void handleQuantityCommit(productId, clamped);
  }

  function toggleOne(productId: string, checked: boolean) {
    setSelected((prev) => ({ ...prev, [productId]: checked }));
  }

  function toggleMany(targetItems: CartItemView[], checked: boolean) {
    setSelected((prev) => {
      const next = { ...prev };
      for (const item of targetItems) {
        if (item.available) next[item.productId] = checked;
      }
      return next;
    });
  }

  if (items.length === 0) {
    return <p className="text-sm text-neutral-700">Giỏ hàng đang trống.</p>;
  }

  const availableItems = items.filter((i) => i.available);
  const selectedItems = availableItems.filter((i) => selected[i.productId]);
  const selectedIds = selectedItems.map((i) => i.productId);
  const allSelected = availableItems.length > 0 && selectedItems.length === availableItems.length;
  const total = selectedItems.reduce(
    (sum, i) => sum + (i.buyNowPrice ?? 0) * (quantityDrafts[i.productId] ?? i.quantity),
    0
  );

  // Gom theo người bán (giữ thứ tự xuất hiện đầu tiên) — mỗi nhóm hiển thị như 1 "shop", có
  // checkbox chọn cả nhóm, giống cách Shopee trình bày giỏ hàng nhiều seller.
  const groups: { sellerId: string; sellerName: string; items: CartItemView[] }[] = [];
  const groupIndex = new Map<string, number>();
  for (const item of items) {
    const idx = groupIndex.get(item.sellerId);
    if (idx === undefined) {
      groupIndex.set(item.sellerId, groups.length);
      groups.push({ sellerId: item.sellerId, sellerName: item.sellerName, items: [item] });
    } else {
      groups[idx].items.push(item);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        {groups.map((group) => {
          const groupAvailable = group.items.filter((i) => i.available);
          const groupSelectedCount = groupAvailable.filter((i) => selected[i.productId]).length;
          const groupAllSelected = groupAvailable.length > 0 && groupSelectedCount === groupAvailable.length;
          return (
            <div key={group.sellerId} className="overflow-hidden rounded-lg border border-neutral-200 bg-surface">
              <label className="flex items-center gap-2 border-b border-neutral-100 bg-neutral-50 px-3 py-2">
                <input
                  type="checkbox"
                  checked={groupAllSelected}
                  disabled={groupAvailable.length === 0}
                  onChange={(e) => toggleMany(group.items, e.target.checked)}
                  className="h-4 w-4 rounded border-neutral-300 disabled:opacity-40"
                />
                <span className="text-sm font-semibold text-text">🏬 {group.sellerName}</span>
              </label>
              <ul className="divide-y divide-neutral-100">
                {group.items.map((item) => {
                  const currentQty = quantityDrafts[item.productId] ?? item.quantity;
                  return (
                    <li
                      key={item.productId}
                      className={`flex items-center gap-3 p-3 ${!item.available ? "opacity-60" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={item.available && !!selected[item.productId]}
                        disabled={!item.available}
                        onChange={(e) => toggleOne(item.productId, e.target.checked)}
                        className="h-4 w-4 shrink-0 rounded border-neutral-300 disabled:opacity-40"
                      />
                      {item.image ? (
                        <Image
                          src={item.image}
                          alt={item.title}
                          width={56}
                          height={56}
                          unoptimized={!isOptimizableProductImage(item.image)}
                          className="h-14 w-14 shrink-0 rounded-md object-cover"
                        />
                      ) : (
                        <div className="h-14 w-14 shrink-0 rounded-md bg-neutral-100" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-text">{item.title}</p>
                        {item.available ? (
                          <>
                            <p className="text-sm text-neutral-700">{formatVND(item.buyNowPrice ?? 0)}</p>
                            <div className="mt-1 flex items-center gap-2">
                              <div className="flex items-center rounded-md border border-neutral-300">
                                <button
                                  type="button"
                                  onClick={() => handleStep(item.productId, currentQty - 1, item.stock)}
                                  disabled={updatingId === item.productId || currentQty <= 1}
                                  className="px-2.5 py-1 text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-40"
                                  aria-label="Giảm số lượng"
                                >
                                  −
                                </button>
                                <input
                                  id={`qty-${item.productId}`}
                                  type="number"
                                  min={1}
                                  max={item.stock}
                                  value={currentQty}
                                  onChange={(e) => handleQuantityChange(item.productId, Number(e.target.value), item.stock)}
                                  onBlur={(e) => handleQuantityCommit(item.productId, Number(e.target.value))}
                                  disabled={updatingId === item.productId}
                                  className="w-12 border-x border-neutral-300 px-1 py-1 text-center text-sm text-text focus:outline-none disabled:opacity-50"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleStep(item.productId, currentQty + 1, item.stock)}
                                  disabled={updatingId === item.productId || currentQty >= item.stock}
                                  className="px-2.5 py-1 text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-40"
                                  aria-label="Tăng số lượng"
                                >
                                  +
                                </button>
                              </div>
                              <span className="text-xs text-neutral-500">Tối đa {item.stock}</span>
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
                        className="shrink-0 rounded-md border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
                      >
                        {removingId === item.productId ? "Đang xoá..." : "Xoá"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="sticky bottom-0 z-10 flex flex-col gap-2 rounded-t-lg border border-neutral-200 bg-surface p-3 shadow-[0_-2px_10px_rgba(0,0,0,0.06)] sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-2 text-sm text-text">
          <input
            type="checkbox"
            checked={allSelected}
            disabled={availableItems.length === 0}
            onChange={(e) => toggleMany(availableItems, e.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 disabled:opacity-40"
          />
          Chọn tất cả ({selectedItems.length}/{availableItems.length})
        </label>
        <p className="text-sm text-neutral-700">
          Tổng thanh toán: <span className="font-heading text-base font-bold text-text">{formatVND(total)}</span>
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-surface p-4">
        <h3 className="font-heading text-sm font-bold text-text">Thông tin nhận hàng</h3>
        <BuyerShippingFields idPrefix="cart" defaultName={defaultName} defaultPhone={defaultPhone} />
        <input type="hidden" name="selectedProductIds" value={JSON.stringify(selectedIds)} />
        {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
        <button
          type="submit"
          disabled={pending || selectedItems.length === 0}
          className="self-start rounded-md bg-accent-2-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-2-700 disabled:opacity-50"
        >
          {pending ? "Đang đặt hàng..." : `Đặt hàng (${selectedItems.length} sản phẩm)`}
        </button>
      </form>
    </div>
  );
}
