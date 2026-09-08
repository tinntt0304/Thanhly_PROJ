import { requireAdmin } from "@/lib/admin-guard";
import { getPendingFacebookPages } from "@/lib/actions/facebook-inbox";
import { FacebookInboxPanel } from "@/components/FacebookInboxPanel";

export default async function FacebookInboxPage({ searchParams }: PageProps<"/admin/hop-thu-facebook">) {
  await requireAdmin();
  const sp = await searchParams;
  const fbError = typeof sp.fb_error === "string" ? sp.fb_error : undefined;
  const showPicker = sp.fb_pick === "1";
  const pendingPages = showPicker ? await getPendingFacebookPages() : [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-lg font-bold text-text">Hộp thư Facebook</h1>
        <p className="mt-1 text-sm text-neutral-700">
          Xem và trả lời tin nhắn Messenger + bình luận từ fanpage của bạn ngay tại đây, không
          cần mở Facebook.
        </p>
      </div>
      <FacebookInboxPanel initialError={fbError} pendingPages={pendingPages} />
    </div>
  );
}
