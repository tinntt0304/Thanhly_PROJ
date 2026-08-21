import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  formatVND,
  getAuctionState,
  getWinningBid,
  AUCTION_STATE_LABEL,
} from "@/lib/auction";
import { setProductStatus } from "@/lib/actions/products";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const products = await prisma.product.findMany({
    orderBy: [{ createdAt: "desc" }],
    include: { bids: { orderBy: { amount: "desc" } } },
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Sản phẩm ({products.length})</h1>

      {products.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Chưa có sản phẩm nào. <Link href="/admin/products/new" className="underline">Đăng sản phẩm đầu tiên</Link>.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-2">Sản phẩm</th>
                <th className="px-4 py-2">Trạng thái</th>
                <th className="px-4 py-2">Giá hiện tại</th>
                <th className="px-4 py-2">Người thắng (SĐT đầy đủ)</th>
                <th className="px-4 py-2">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {products.map((product) => {
                const state = getAuctionState(product, product.bids.length > 0);
                const winningBid =
                  state === "ENDED_AWAITING_CONTACT" || state === "SOLD"
                    ? getWinningBid(product.bids)
                    : null;

                const markSold = setProductStatus.bind(null, product.id, "SOLD");
                const markCancelled = setProductStatus.bind(null, product.id, "CANCELLED");
                const markActive = setProductStatus.bind(null, product.id, "ACTIVE");

                return (
                  <tr key={product.id}>
                    <td className="px-4 py-2">
                      <Link
                        href={`/admin/products/${product.id}`}
                        className="font-medium hover:underline"
                      >
                        {product.title}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{AUCTION_STATE_LABEL[state]}</td>
                    <td className="px-4 py-2">{formatVND(product.currentPrice)}</td>
                    <td className="px-4 py-2">
                      {winningBid ? winningBid.phone : "—"}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-2">
                        {product.status !== "SOLD" && (
                          <form action={markSold}>
                            <button className="rounded-md border border-blue-300 px-2 py-1 text-xs text-blue-700 hover:bg-blue-50">
                              Đánh dấu đã bán
                            </button>
                          </form>
                        )}
                        {product.status !== "CANCELLED" && (
                          <form action={markCancelled}>
                            <button className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50">
                              Huỷ
                            </button>
                          </form>
                        )}
                        {product.status !== "ACTIVE" && (
                          <form action={markActive}>
                            <button className="rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50">
                              Mở lại
                            </button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
