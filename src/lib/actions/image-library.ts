"use server";

import { requireAdmin } from "@/lib/admin-guard";
import { uploadLibraryImage } from "@/lib/storage";

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
