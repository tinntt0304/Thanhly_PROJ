import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { getPendingFacebookPages } from "@/lib/actions/facebook-inbox";
import { FacebookConnectionSettings } from "@/components/FacebookConnectionSettings";
import { PickupAddressForm } from "@/components/PickupAddressForm";

export default async function AdminSettingsPage({ searchParams }: PageProps<"/admin/cai-dat">) {
  const session = await requireAdmin();
  const sp = await searchParams;
  const fbError = typeof sp.fb_error === "string" ? sp.fb_error : undefined;
  const fbInfo = typeof sp.fb_info === "string" ? sp.fb_info : undefined;
  const fbTotal = typeof sp.fb_total === "string" ? Number(sp.fb_total) : undefined;
  const showPicker = sp.fb_pick === "1";
  const pickupRequired = sp.pickup_required === "1";
  const [pendingPages, user] = await Promise.all([
    showPicker ? getPendingFacebookPages() : Promise.resolve([]),
    prisma.user.findUniqueOrThrow({ where: { id: session.user.id } }),
  ]);

  return (
    <div className="flex max-w-lg flex-col gap-8">
      <div>
        <h1 className="font-heading text-lg font-bold text-text">Cài đặt</h1>
        <p className="mt-1 text-sm text-neutral-700">Cấu hình các kết nối bên ngoài cho tài khoản của bạn.</p>
      </div>

      <section
        className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-surface p-4"
      >
        <div>
          <h2 className="font-heading text-sm font-bold text-text">Địa chỉ lấy hàng</h2>
          <p className="mt-1 text-sm text-neutral-700">
            Đơn vị vận chuyển (GHN) dùng địa chỉ này để lấy hàng — bắt buộc phải có trước khi
            tạo đơn hàng hoặc tạo vận đơn.
          </p>
        </div>
        {pickupRequired && (
          <p className="rounded-md bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
            Bạn cần thêm địa chỉ lấy hàng trước khi tạo đơn hoặc tạo vận đơn GHN.
          </p>
        )}
        <PickupAddressForm
          defaultPickupName={user.pickupName ?? session.user.name ?? undefined}
          defaultPickupPhone={user.pickupPhone ?? session.user.phone ?? undefined}
          defaultPickupAddress={user.pickupAddress ?? undefined}
          defaultProvinceId={user.pickupProvinceId ?? undefined}
          defaultProvinceName={user.pickupProvinceName ?? undefined}
          defaultDistrictId={user.pickupDistrictId ?? undefined}
          defaultDistrictName={user.pickupDistrictName ?? undefined}
          defaultWardCode={user.pickupWardCode ?? undefined}
          defaultWardName={user.pickupWardName ?? undefined}
        />
      </section>

      <section
        data-tour="settings"
        className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-surface p-4"
      >
        <div>
          <h2 className="font-heading text-sm font-bold text-text">Kết nối Facebook</h2>
          <p className="mt-1 text-sm text-neutral-700">
            Kết nối 1 lần ở đây, sau đó xem và trả lời tin nhắn Messenger + bình luận ở{" "}
            <span className="font-medium">Hộp thư Facebook</span> — không cần mở Facebook.
          </p>
        </div>
        <FacebookConnectionSettings
          initialError={fbError}
          initialInfo={fbInfo}
          fbTotal={fbTotal}
          pendingPages={pendingPages}
        />
      </section>
    </div>
  );
}
