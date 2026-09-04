import Link from "next/link";
import { requireAdmin } from "@/lib/admin-guard";
import { listOrders } from "@/lib/actions/orders";
import { ORDER_LIST_TABS, orderDisplayStatusLabel, type OrderListTab } from "@/lib/orders";
import { formatVND, formatDateTime } from "@/lib/auction";

export const dynamic = "force-dynamic";

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export default async function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  const session = await requireAdmin();
  const isSuperAdmin = session.user.role === "SUPERADMIN";
  const sp = await searchParams;
  const page = typeof sp.page === "string" ? Number(sp.page) || 1 : 1;
  const tab: OrderListTab = ORDER_LIST_TABS.some((t) => t.key === sp.tab) ? (sp.tab as OrderListTab) : "ALL";
  const from = typeof sp.from === "string" ? sp.from : "";
  const to = typeof sp.to === "string" ? sp.to : "";

  const { items, totalCount, pageSize, tabCounts } = await listOrders(page, tab, from || undefined, to || undefined);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-lg font-bold text-text">Đơn hàng</h1>

      <div className="flex flex-wrap gap-2 overflow-x-auto border-b border-neutral-200 pb-px">
        {ORDER_LIST_TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/orders${buildQuery({ tab: t.key === "ALL" ? undefined : t.key, from, to })}`}
            className={`flex shrink-0 items-center gap-1.5 rounded-t-md border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-accent-500 text-accent-600"
                : "border-transparent text-neutral-600 hover:text-text"
            }`}
          >
            {t.label}
            <span
              className={`rounded-full px-1.5 py-0.5 text-xs ${
                tab === t.key ? "bg-accent-100 text-accent-700" : "bg-neutral-100 text-neutral-600"
              }`}
            >
              {tabCounts[t.key]}
            </span>
          </Link>
        ))}
      </div>

      <form method="GET" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="tab" value={tab} />
        <div className="flex flex-col gap-1">
          <label htmlFor="from" className="text-sm font-medium text-text">
            Thời gian tạo đơn — Từ
          </label>
          <input
            id="from"
            name="from"
            type="date"
            defaultValue={from}
            className="rounded-md border border-neutral-300 bg-surface px-3 py-2 text-sm text-text focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="to" className="text-sm font-medium text-text">
            Đến
          </label>
          <input
            id="to"
            name="to"
            type="date"
            defaultValue={to}
            className="rounded-md border border-neutral-300 bg-surface px-3 py-2 text-sm text-text focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600"
        >
          Lọc
        </button>
        {(from || to) && (
          <Link
            href={`/admin/orders${buildQuery({ tab: tab === "ALL" ? undefined : tab })}`}
            className="text-sm text-neutral-500 underline"
          >
            Bỏ lọc ngày
          </Link>
        )}
        <span className="pb-2 text-sm text-neutral-600">
          Hiển thị {items.length}/{totalCount} đơn hàng
        </span>
      </form>

      {items.length === 0 ? (
        <p className="text-sm text-neutral-700">
          Không có đơn hàng nào khớp bộ lọc — tạo đơn từ trang sửa 1 sản phẩm đã đánh dấu
          &ldquo;Đã bán&rdquo;.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-100 text-left text-xs uppercase text-neutral-700">
              <tr>
                <th className="px-4 py-2">Đơn hàng</th>
                <th className="px-4 py-2">Bên nhận</th>
                {isSuperAdmin && <th className="px-4 py-2">Người bán</th>}
                <th className="px-4 py-2">Thu hộ</th>
                <th className="px-4 py-2">KL tính phí</th>
                <th className="px-4 py-2">Tuỳ chọn thanh toán</th>
                <th className="px-4 py-2">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {items.map((order) => (
                <tr key={order.id}>
                  <td className="px-4 py-2">
                    <Link href={`/admin/orders/${order.id}`} className="font-medium text-text hover:underline">
                      {order.items[0]?.product.title ?? "—"}
                      {order.items.length > 1 && ` và ${order.items.length - 1} sản phẩm khác`}
                    </Link>
                    {order.ghnOrderCode && (
                      <span className="block font-mono text-xs text-neutral-500">{order.ghnOrderCode}</span>
                    )}
                    <span className="block text-xs text-neutral-500">{formatDateTime(order.createdAt)}</span>
                  </td>
                  <td className="px-4 py-2 text-neutral-700">
                    {order.buyerName || "—"}
                    <span className="block text-xs text-neutral-500">{order.buyerPhone}</span>
                    <span className="block text-xs text-neutral-500">
                      {order.wardName}, {order.districtName}, {order.provinceName}
                    </span>
                  </td>
                  {isSuperAdmin && <td className="px-4 py-2 text-neutral-700">{order.seller.name}</td>}
                  <td className="px-4 py-2 text-text">{order.codAmount > 0 ? formatVND(order.codAmount) : "—"}</td>
                  <td className="px-4 py-2 text-neutral-700">{order.weightGram}g</td>
                  <td className="px-4 py-2 text-neutral-700">
                    {order.shopPaysShipping ? "Shop trả phí" : "Bên nhận trả phí"}
                    {order.shippingFee !== null && (
                      <span className="block text-xs text-neutral-500">Phí ship: {formatVND(order.shippingFee)}</span>
                    )}
                  </td>
                  <td className="px-4 py-2">{orderDisplayStatusLabel(order)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Link
            href={`/admin/orders${buildQuery({ tab: tab === "ALL" ? undefined : tab, from, to, page: page - 1 })}`}
            aria-disabled={page <= 1}
            className={`rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}
          >
            ← Trang trước
          </Link>
          <span className="text-sm text-neutral-700">
            Trang {page} / {totalPages}
          </span>
          <Link
            href={`/admin/orders${buildQuery({ tab: tab === "ALL" ? undefined : tab, from, to, page: page + 1 })}`}
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
