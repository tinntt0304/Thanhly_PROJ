import Image from "next/image";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin-guard";
import { getDashboardStats } from "@/lib/dashboard-stats";
import { formatVND } from "@/lib/auction";
import { ORDER_STATUS_LABEL } from "@/lib/orders";
import { isOptimizableProductImage } from "@/lib/image-url";

export const dynamic = "force-dynamic";

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-neutral-200 bg-surface p-4">
      <p className="text-sm text-neutral-600">{label}</p>
      <p className="font-heading text-2xl font-bold text-text">{value}</p>
      {hint && <p className="text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}

const ORDER_STATUS_ORDER = ["NEW", "SHIPPING", "DELIVERED", "CANCELLED"] as const;

export default async function DashboardPage() {
  const session = await requireAdmin();
  const isSuperAdmin = session.user.role === "SUPERADMIN";
  const stats = await getDashboardStats(session.user.id, isSuperAdmin);

  const maxOrderCount = Math.max(1, ...ORDER_STATUS_ORDER.map((s) => stats.orders.byStatus[s]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-lg font-bold text-text">Thống kê</h1>
        <p className="mt-1 text-sm text-neutral-700">
          {isSuperAdmin ? "Tổng quan toàn sàn." : "Tổng quan hoạt động bán hàng của bạn."}
        </p>
      </div>

      <div data-tour="stats" className="flex flex-col gap-6">
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-sm font-bold text-text">Sản phẩm</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Đang đấu giá" value={stats.products.bidding.toLocaleString("vi-VN")} />
            <StatCard label="Đã bán" value={stats.products.sold.toLocaleString("vi-VN")} />
            <StatCard
              label="Hết giờ chưa xử lý"
              value={stats.products.endedUnresolved.toLocaleString("vi-VN")}
              hint={stats.products.endedUnresolved > 0 ? "Cần đánh dấu Đã bán/Đã huỷ" : undefined}
            />
            <StatCard label="Tổng số đã đăng" value={stats.products.total.toLocaleString("vi-VN")} />
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-heading text-sm font-bold text-text">Đơn hàng theo trạng thái</h2>
            <Link href="/admin/orders" className="text-sm text-accent-600 underline">
              Xem danh sách đơn hàng
            </Link>
          </div>
          <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-surface p-4">
            {ORDER_STATUS_ORDER.map((s) => {
              const count = stats.orders.byStatus[s];
              const widthPct = (count / maxOrderCount) * 100;
              return (
                <div key={s} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-sm text-neutral-700">{ORDER_STATUS_LABEL[s]}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
                    <div
                      className={`h-full rounded-full ${s === "CANCELLED" ? "bg-red-400" : "bg-accent-500"}`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-sm font-medium text-text">{count}</span>
                </div>
              );
            })}
            <p className="mt-1 text-xs text-neutral-500">Tổng {stats.orders.total.toLocaleString("vi-VN")} đơn.</p>
          </div>
          <StatCard
            label="Giá trị hàng đã giao thành công"
            value={formatVND(stats.orders.deliveredRevenue)}
            hint="Tổng tiền hàng (chưa gồm phí ship) của các đơn Đã giao"
          />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-sm font-bold text-text">Sản phẩm bán chạy nhất</h2>
          {stats.topSelling.length === 0 ? (
            <p className="text-sm text-neutral-500">Chưa có đơn hàng nào để thống kê.</p>
          ) : (
            <div className="flex flex-col divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-surface">
              {stats.topSelling.map((item, i) => (
                <div key={item.productId} className="flex items-center gap-3 p-3">
                  <span className="w-5 shrink-0 text-center text-sm font-semibold text-neutral-400">{i + 1}</span>
                  {item.image ? (
                    <Image
                      src={item.image}
                      alt={item.title}
                      width={44}
                      height={44}
                      unoptimized={!isOptimizableProductImage(item.image)}
                      className="h-11 w-11 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <div className="h-11 w-11 shrink-0 rounded-md bg-neutral-100" />
                  )}
                  <p className="min-w-0 flex-1 truncate text-sm text-text">{item.title}</p>
                  <span className="shrink-0 rounded-full bg-accent-100 px-2.5 py-1 text-xs font-semibold text-accent-700">
                    Đã bán {item.quantitySold.toLocaleString("vi-VN")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
