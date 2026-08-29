"use server";

import { requireAdmin } from "@/lib/admin-guard";
import { uploadLibraryImage, deleteLibraryImage, parseLibraryImagePath } from "@/lib/storage";

export type LibraryUploadState = { error?: string; images?: { url: string; name: string }[] };

// Chỉ tải lên cho chính người đang đăng nhập (userId lấy từ session, không nhận qua form) —
// mỗi seller chỉ thêm được ảnh vào thư mục của chính mình trong bucket image-library, xem
// listLibraryImages/uploadLibraryImage ở lib/storage.ts.
export async function uploadLibraryImages(
  _prevState: LibraryUploadState | undefined,
  formData: FormData
): Promise<LibraryUploadState> {
  const session = await requireAdmin();

  const files = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: "Chưa chọn ảnh." };

  try {
    const urls = await Promise.all(files.map((f) => uploadLibraryImage(f, session.user.id)));
    return { images: urls.map((url, i) => ({ url, name: files[i].name })) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Upload ảnh thất bại." };
  }
}

// Chỉ xoá được ảnh của chính mình — đối chiếu userId trong path (thư mục con {userId}/) với
// session hiện tại trước khi xoá thật, chặn 1 seller xoá ảnh của seller khác dù biết/đoán
// được URL. Superadmin xoá được ảnh của bất kỳ ai (đúng tinh thần xem được tất cả ở
// listLibraryImages).
export async function removeLibraryImage(url: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireAdmin();

  const parsed = parseLibraryImagePath(url);
  if (!parsed) return { ok: false, error: "URL ảnh không hợp lệ." };
  if (session.user.role !== "SUPERADMIN" && parsed.userId !== session.user.id) {
    return { ok: false, error: "Bạn không có quyền xoá ảnh này." };
  }

  try {
    await deleteLibraryImage(parsed.path);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Xoá ảnh thất bại." };
  }
  return { ok: true };
}
