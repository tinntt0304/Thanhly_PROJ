import Link from "next/link";
import { requireAdmin } from "@/lib/admin-guard";
import { listOrders } from "@/lib/actions/orders";
import { ORDER_STATUS_LABEL } from "@/lib/orders";
import { ghnStatusLabel } from "@/lib/ghn";
import { formatVND, formatDateTime } from "@/lib/auction";

export const dynamic = "force-dynamic";

export default async function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  const session = await requireAdmin();
  const isSuperAdmin = session.user.role === "SUPERADMIN";
  const { page: pageParam } = await searchParams;
  const page = typeof pageParam === "string" ? Number(pageParam) || 1 : 1;

  const { items, totalCount, pageSize } = await listOrders(page);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-lg font-bold text-text">Đơn hàng ({totalCount})</h1>

      {items.length === 0 ? (
        <p className="text-sm text-neutral-700">
          Chưa có đơn hàng nào — tạo đơn từ trang sửa 1 sản phẩm đã đánh dấu &ldquo;Đã bán&rdquo;.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-100 text-left text-xs uppercase text-neutral-700">
              <tr>
                <th className="px-4 py-2">Sản phẩm</th>
                <th className="px-4 py-2">Người nhận</th>
                {isSuperAdmin && <th className="px-4 py-2">Người bán</th>}
                <th className="px-4 py-2">COD</th>
                <th className="px-4 py-2">Trạng thái</th>
                <th className="px-4 py-2">Vận đơn GHN</th>
                <th className="px-4 py-2">Ngày tạo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {items.map((order) => (
                <tr key={order.id}>
                  <td className="px-4 py-2">
                    <Link href={`/admin/orders/${order.id}`} className="font-medium text-text hover:underline">
                      {order.product.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-neutral-700">
                    {order.buyerName || "—"}
                    <span className="block text-xs text-neutral-500">{order.buyerPhone}</span>
                  </td>
                  {isSuperAdmin && (
                    <td className="px-4 py-2 text-neutral-700">{order.seller.name}</td>
                  )}
                  <td className="px-4 py-2">{formatVND(order.codAmount)}</td>
                  <td className="px-4 py-2">{ORDER_STATUS_LABEL[order.status]}</td>
                  <td className="px-4 py-2 text-neutral-700">
                    {order.ghnOrderCode ? (
                      <>
                        <span className="font-mono">{order.ghnOrderCode}</span>
                        {order.ghnStatus && (
                          <span className="block text-xs text-neutral-500">{ghnStatusLabel(order.ghnStatus)}</span>
                        )}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2 text-neutral-500">{formatDateTime(order.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Link
            href={`/admin/orders?page=${page - 1}`}
            aria-disabled={page <= 1}
            className={`rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}
          >
            ← Trang trước
          </Link>
          <span className="text-sm text-neutral-700">
            Trang {page} / {totalPages}
          </span>
          <Link
            href={`/admin/orders?page=${page + 1}`}
            aria-disabled={page >= totalPages}
            className={`rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 ${page >= totalPages ? "pointer-events-none opacity-40" : ""}`}
          >
            Trang sau →
          </Link>
        </div>
      )}
    </div>
  );
}
