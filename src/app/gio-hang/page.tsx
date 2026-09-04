import Link from "next/link";
import { requireAdmin } from "@/lib/admin-guard";
import { getCartItems } from "@/lib/actions/cart";
import { listMyActiveBids } from "@/lib/actions/buyer-orders";
import { SiteHeader } from "@/components/SiteHeader";
import { CartCheckoutForm, type CartItemView } from "@/components/CartCheckoutForm";
import { Countdown } from "@/components/Countdown";
import { formatVND } from "@/lib/auction";

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const session = await requireAdmin();
  const [cartItems, activeBids] = await Promise.all([getCartItems(), listMyActiveBids()]);

  const items: CartItemView[] = cartItems.map((item) => ({
    productId: item.productId,
    title: item.product.title,
    image: item.product.images[0] ?? null,
    buyNowPrice: item.product.buyNowPrice,
    available: item.product.status === "ACTIVE" && item.product.quantity > 0 && !!item.product.buyNowPrice,
  }));

  return (
    <main className="flex-1">
      <SiteHeader />
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-6">
        <section className="flex flex-col gap-3">
          <h1 className="font-heading text-lg font-bold text-text">Giỏ hàng</h1>
          <CartCheckoutForm
            items={items}
            defaultName={session.user.name ?? undefined}
            defaultPhone={session.user.phone ?? undefined}
          />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-lg font-bold text-text">Đang đấu giá</h2>
          {activeBids.length === 0 ? (
            <p className="text-sm text-neutral-700">Bạn chưa trả giá cho sản phẩm nào.</p>
          ) : (
            <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-surface">
              {activeBids.map((bid) => (
                <li key={bid.productId} className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <div>
                    <Link href={`/products/${bid.productId}`} className="text-sm font-medium text-text hover:underline">
                      {bid.productTitle}
                    </Link>
                    <p className="text-sm text-neutral-700">
                      Giá của bạn: {formatVND(bid.myBestAmount)} · Giá hiện tại: {formatVND(bid.currentPrice)}
                    </p>
                    {bid.status === "ACTIVE" && (
                      <p className="text-xs text-neutral-500">
                        Còn lại: <Countdown endTime={bid.endTime.toISOString()} />
                      </p>
                    )}
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      bid.isWinning
                        ? "bg-accent-2-100 text-accent-2-700"
                        : "bg-red-50 text-red-700"
                    }`}
                  >
                    {bid.isWinning ? "Đang dẫn đầu" : "Đã bị vượt qua"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
