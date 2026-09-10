import { requireAdmin } from "@/lib/admin-guard";
import { getPendingFacebookPages } from "@/lib/actions/facebook-inbox";
import { FacebookConnectionSettings } from "@/components/FacebookConnectionSettings";

export default async function AdminSettingsPage({ searchParams }: PageProps<"/admin/cai-dat">) {
  await requireAdmin();
  const sp = await searchParams;
  const fbError = typeof sp.fb_error === "string" ? sp.fb_error : undefined;
  const fbInfo = typeof sp.fb_info === "string" ? sp.fb_info : undefined;
  const showPicker = sp.fb_pick === "1";
  const pendingPages = showPicker ? await getPendingFacebookPages() : [];

  return (
    <div className="flex max-w-lg flex-col gap-8">
      <div>
        <h1 className="font-heading text-lg font-bold text-text">Cài đặt</h1>
        <p className="mt-1 text-sm text-neutral-700">Cấu hình các kết nối bên ngoài cho tài khoản của bạn.</p>
      </div>

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
        <FacebookConnectionSettings initialError={fbError} initialInfo={fbInfo} pendingPages={pendingPages} />
      </section>
    </div>
  );
}
