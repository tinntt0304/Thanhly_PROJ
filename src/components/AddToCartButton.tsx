"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { addToCart } from "@/lib/actions/cart";
import type { Attribute } from "@/lib/attributes";

// Nút "Thêm vào giỏ" cạnh BuyNowButton — chỉ hiện khi sản phẩm có buyNowPrice (giỏ hàng không
// áp dụng cho đấu giá, xem CartItem trong schema.prisma). Khác BuyNowButton (form riêng, tạo
// đơn ngay): đây chỉ gọi addToCart rồi để buyer tự vào /gio-hang checkout gộp nhiều sản phẩm.
export function AddToCartButton({
  productId,
  attributes,
  canBuy,
  isLoggedIn,
  stock,
}: {
  productId: string;
  attributes: Attribute[];
  canBuy: boolean;
  isLoggedIn: boolean;
  // Số lượng thật còn lại — trần cho bộ đếm +/-, giống BuyNowButton (xem lib/actions/cart.ts).
  stock: number;
}) {
  const router = useRouter();
  const [selectedValues, setSelectedValues] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  if (!canBuy) return null;

  if (!isLoggedIn) {
    return (
      <Link
        href={`/admin/login?next=/products/${productId}`}
        className="self-start rounded-md border border-accent-2-300 px-4 py-2 text-sm font-medium text-accent-2-700 transition-colors hover:bg-accent-2-50"
      >
        Đăng nhập để thêm vào giỏ
      </Link>
    );
  }

  async function handleAdd() {
    if (attributes.length > 0) {
      const missing = attributes.find((attr) => !selectedValues[attr.name]);
      if (missing) {
        setError(`Vui lòng chọn "${missing.name}".`);
        return;
      }
    }
    if (quantity < 1 || quantity > stock) {
      setError(`Số lượng phải từ 1 đến ${stock}.`);
      return;
    }
    setPending(true);
    setError(null);
    const json = JSON.stringify(
      attributes.map((attr) => ({ name: attr.name, value: selectedValues[attr.name] ?? "" }))
    );
    const res = await addToCart(productId, json, quantity);
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setAdded(true);
    router.refresh();
  }

  if (added) {
    return (
      <Link
        href="/gio-hang"
        className="self-start rounded-md border border-accent-2-300 bg-accent-2-100 px-4 py-2 text-sm font-medium text-accent-2-700"
      >
        Đã thêm vào giỏ — Xem giỏ hàng →
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {attributes.length > 0 && (
        <div className="flex flex-col gap-2">
          {attributes.map((attr) => (
            <div key={attr.name} className="flex flex-col gap-1">
              <label className="text-sm font-medium text-text">{attr.name}</label>
              <div className="flex flex-wrap gap-1.5">
                {attr.values.map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setSelectedValues((prev) => ({ ...prev, [attr.name]: val }))}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      selectedValues[attr.name] === val
                        ? "border-accent-500 bg-accent-100 text-accent-700"
                        : "border-neutral-300 text-neutral-700 hover:bg-neutral-100"
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-text">Số lượng</span>
        <div className="flex items-center rounded-md border border-neutral-300">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1}
            className="px-2.5 py-1 text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-40"
            aria-label="Giảm số lượng"
          >
            −
          </button>
          <input
            type="number"
            min={1}
            max={stock}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="w-12 border-x border-neutral-300 px-1 py-1 text-center text-sm text-text focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(stock, q + 1))}
            disabled={quantity >= stock}
            className="px-2.5 py-1 text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-40"
            aria-label="Tăng số lượng"
          >
            +
          </button>
        </div>
        <span className="text-xs text-neutral-500">Tối đa {stock}</span>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={handleAdd}
        disabled={pending}
        className="self-start rounded-md border border-accent-2-300 px-4 py-2 text-sm font-medium text-accent-2-700 transition-colors hover:bg-accent-2-50 disabled:opacity-50"
      >
        {pending ? "Đang thêm..." : "🛒 Thêm vào giỏ"}
      </button>
    </div>
  );
}
