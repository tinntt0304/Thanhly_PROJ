"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { addToCart } from "@/lib/actions/cart";
import type { Attribute } from "@/lib/attributes";
import { formatVND } from "@/lib/auction";

// Khối "Mua ngay — không cần đấu giá" ở trang sản phẩm công khai: chọn Mẫu (nếu có) + số
// lượng, rồi 1 trong 2 nút:
// - "Thêm vào giỏ hàng": chỉ addToCart, KHÔNG điều hướng — buyer ở lại trang để thêm tiếp
//   sản phẩm/mẫu khác vào giỏ trước khi qua trang giỏ hàng.
// - "Mua ngay": cũng addToCart (đúng sản phẩm + số lượng đang chọn) rồi điều hướng thẳng sang
//   /gio-hang để điền thông tin nhận hàng — tái dùng nguyên form nhận hàng + tạo đơn ở
//   CartCheckoutForm (trước đây form này nằm trong modal riêng của nút Mua ngay, giờ dùng
//   chung với giỏ hàng thay vì tạo đơn thẳng từ trang sản phẩm).
export function ProductBuyPanel({
  productId,
  buyNowPrice,
  attributes,
  canBuy,
  isLoggedIn,
  stock,
}: {
  productId: string;
  buyNowPrice: number;
  attributes: Attribute[];
  // false khi phiên đấu giá không còn ở trạng thái BIDDING (đã hết giờ/đã bán/đã huỷ).
  canBuy: boolean;
  isLoggedIn: boolean;
  // Số lượng thật còn lại — trần cho bộ đếm số lượng.
  stock: number;
}) {
  const router = useRouter();
  const [selectedValues, setSelectedValues] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [pending, setPending] = useState<"cart" | "buy" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addedMessage, setAddedMessage] = useState<string | null>(null);

  if (!canBuy) return null;

  if (!isLoggedIn) {
    return (
      <Link
        href={`/admin/login?next=/products/${productId}`}
        className="self-start rounded-md border border-accent-2-300 px-4 py-2 text-sm font-medium text-accent-2-700 transition-colors hover:bg-accent-2-50"
      >
        Đăng nhập để mua hàng
      </Link>
    );
  }

  function selectAttribute(name: string, value: string) {
    setSelectedValues((prev) => ({ ...prev, [name]: value }));
    // Đổi mẫu là chọn lại từ đầu — số lượng đang chọn có thể không còn hợp lệ với mẫu mới
    // (mỗi mẫu tồn kho khác nhau), nên reset về 1 để buyer tự chọn lại đúng số lượng.
    setQuantity(1);
    setError(null);
    setAddedMessage(null);
  }

  function changeQuantity(value: number) {
    setQuantity(value);
    setError(null);
    setAddedMessage(null);
  }

  function validate(): string | null {
    const missing = attributes.find((attr) => !selectedValues[attr.name]);
    if (missing) return `Vui lòng chọn "${missing.name}".`;
    if (quantity < 1 || quantity > stock) return `Số lượng phải từ 1 đến ${stock}.`;
    return null;
  }

  function buildAttributesJson() {
    return JSON.stringify(
      attributes.map((attr) => ({ name: attr.name, value: selectedValues[attr.name] ?? "" }))
    );
  }

  async function handleAddToCart() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      setAddedMessage(null);
      return;
    }
    setPending("cart");
    setError(null);
    const res = await addToCart(productId, buildAttributesJson(), quantity);
    setPending(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setAddedMessage(`Đã thêm ${quantity} sản phẩm vào giỏ hàng.`);
    router.refresh();
  }

  async function handleBuyNow() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      setAddedMessage(null);
      return;
    }
    setPending("buy");
    setError(null);
    const res = await addToCart(productId, buildAttributesJson(), quantity);
    setPending(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.push("/gio-hang");
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-accent-2-300 bg-accent-2-50 p-4">
      <div>
        <p className="text-sm font-semibold text-accent-2-700">🛒 Mua ngay — không cần đấu giá</p>
        <p className="text-sm text-neutral-700">
          Giá: <span className="font-semibold text-text">{formatVND(buyNowPrice)}</span>
        </p>
      </div>

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
                    onClick={() => selectAttribute(attr.name, val)}
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
        <div className="flex items-center rounded-md border border-neutral-300 bg-surface">
          <button
            type="button"
            onClick={() => changeQuantity(Math.max(1, quantity - 1))}
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
            onChange={(e) => changeQuantity(Number(e.target.value))}
            className="w-12 border-x border-neutral-300 px-1 py-1 text-center text-sm text-text focus:outline-none"
          />
          <button
            type="button"
            onClick={() => changeQuantity(Math.min(stock, quantity + 1))}
            disabled={quantity >= stock}
            className="px-2.5 py-1 text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-40"
            aria-label="Tăng số lượng"
          >
            +
          </button>
        </div>
        <span className="text-xs text-neutral-600">Tối đa {stock}</span>
      </div>

      <p className="text-sm text-neutral-700">
        Thành tiền: <span className="font-semibold text-text">{formatVND(buyNowPrice * Math.max(quantity, 0))}</span>
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {addedMessage && <p className="text-sm text-accent-2-700">{addedMessage}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={pending !== null}
          className="rounded-md border border-accent-2-300 bg-surface px-4 py-2 text-sm font-medium text-accent-2-700 transition-colors hover:bg-accent-2-100 disabled:opacity-50"
        >
          {pending === "cart" ? "Đang thêm..." : "🛒 Thêm vào giỏ hàng"}
        </button>
        <button
          type="button"
          onClick={handleBuyNow}
          disabled={pending !== null}
          className="rounded-md bg-accent-2-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-2-700 disabled:opacity-50"
        >
          {pending === "buy" ? "Đang xử lý..." : "Mua ngay"}
        </button>
      </div>
    </div>
  );
}
