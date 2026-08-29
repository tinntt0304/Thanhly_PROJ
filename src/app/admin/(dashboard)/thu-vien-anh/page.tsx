import { requireAdmin } from "@/lib/admin-guard";
import { listLibraryImages } from "@/lib/storage";
import { ImageLibraryManager } from "@/components/ImageLibraryManager";

export const dynamic = "force-dynamic";

export default async function ImageLibraryPage() {
  const session = await requireAdmin();
  const isSuperAdmin = session.user.role === "SUPERADMIN";
  const images = await listLibraryImages(isSuperAdmin ? null : session.user.id);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-lg font-bold text-text">Thư viện ảnh</h1>
        <p className="mt-1 text-sm text-neutral-700">
          Tải ảnh lên, lấy link để dán vào cột &ldquo;Ảnh&rdquo; khi import sản phẩm hàng loạt
          bằng Excel — không cần đăng từng sản phẩm mới upload được ảnh.
          {isSuperAdmin && " Superadmin xem được ảnh của tất cả người bán."}
        </p>
      </div>
      <ImageLibraryManager initialImages={images} />
    </div>
  );
}
