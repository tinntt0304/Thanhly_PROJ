import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { getAuctionState, getWinningBid } from "@/lib/auction";
import { setProductStatus } from "@/lib/actions/products";
import { ProductsTable, type ProductRow } from "@/components/ProductsTable";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const session = await requireAdmin();
  const isSuperAdmin = session.user.role === "SUPERADMIN";

  // SUPERADMIN thấy sản phẩm của tất cả người bán (để giám sát toàn sàn); SELLER chỉ
  // thấy sản phẩm của chính mình.
  const products = await prisma.product.findMany({
    where: isSuperAdmin ? undefined : { sellerId: session.user.id },
    orderBy: [{ createdAt: "desc" }],
    include: { bids: { orderBy: { amount: "desc" } }, seller: { select: { name: true } } },
  });

  const rows: ProductRow[] = products.map((product) => {
    const state = getAuctionState(product, product.bids.length > 0);
    // Hiển thị người trả giá cao nhất bất kể phiên còn mở hay đã kết thúc — để người bán
    // theo dõi được ai đang đấu giá sản phẩm nào ngay trong lúc phiên còn diễn ra, không
    // phải chờ đến khi kết thúc mới thấy SĐT.
    const topBid = getWinningBid(product.bids);

    return {
      id: product.id,
      title: product.title,
      sellerName: product.seller?.name ?? null,
      state,
      currentPrice: product.currentPrice,
      bidCount: product.bids.length,
      topBidPhone: topBid?.phone ?? null,
      status: product.status,
      markSold: setProductStatus.bind(null, product.id, "SOLD"),
      markCancelled: setProductStatus.bind(null, product.id, "CANCELLED"),
      markActive: setProductStatus.bind(null, product.id, "ACTIVE"),
    };
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-heading text-lg font-bold text-text">Sản phẩm ({products.length})</h1>
        <Link
          href="/admin/products/import"
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
        >
          Import từ Excel
        </Link>
      </div>

      {products.length === 0 ? (
        <p className="text-sm text-neutral-700">
          Chưa có sản phẩm nào.{" "}
          <Link href="/admin/products/new" className="text-accent-600 underline">
            Đăng sản phẩm đầu tiên
          </Link>
          .
        </p>
      ) : (
        <ProductsTable rows={rows} isSuperAdmin={isSuperAdmin} />
      )}
    </div>
  );
}
