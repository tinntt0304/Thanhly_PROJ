"use server";

import { requireAdmin } from "@/lib/admin-guard";
import { uploadLibraryImage, deleteLibraryImages, parseLibraryImagePath } from "@/lib/storage";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { TOO_MANY_UPLOADS_ERROR } from "@/lib/image-library-messages";

export type LibraryUploadState = { error?: string; images?: { url: string; name: string }[] };

// Chỉ tải lên cho chính người đang đăng nhập (userId lấy từ session, không nhận qua form) —
// mỗi seller chỉ thêm được ảnh vào thư mục của chính mình trong bucket image-library, xem
// listLibraryImages/uploadLibraryImage ở lib/storage.ts.
//
// Rate-limit theo SỐ ẢNH (weight = files.length, không phải theo lượt gọi) — mỗi ảnh tốn
// CPU thật (nén qua sharp) + băng thông/dung lượng Supabase Storage thật, đăng ký tài khoản
// công khai nên bất kỳ ai cũng gọi được action này; không giới hạn thì 1 tài khoản/script có
// thể spam upload liên tục làm chậm server (nén ảnh) và tốn quota lưu trữ. Giới hạn theo
// userId (chặn 1 tài khoản spam) VÀ theo IP (chặn 1 nguồn tạo nhiều tài khoản để né giới hạn
// userId — dù giờ đăng ký đã bắt buộc xác minh OTP, vẫn thêm lớp này cho chắc).
export async function uploadLibraryImages(
  _prevState: LibraryUploadState | undefined,
  formData: FormData
): Promise<LibraryUploadState> {
  const session = await requireAdmin();

  const files = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: "Chưa chọn ảnh." };

  const ip = await getClientIp();
  const [userOk, ipOk] = await Promise.all([
    checkRateLimit(`library-upload-user:${session.user.id}`, 60, 600, files.length),
    checkRateLimit(`library-upload-ip:${ip}`, 120, 600, files.length),
  ]);
  if (!userOk || !ipOk) {
    return { error: TOO_MANY_UPLOADS_ERROR };
  }

  try {
    const urls = await Promise.all(files.map((f) => uploadLibraryImage(f, session.user.id)));
    return { images: urls.map((url, i) => ({ url, name: files[i].name })) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Upload ảnh thất bại." };
  }
}

// Nhận nhiều URL cùng lúc (xoá 1 ảnh gọi với mảng 1 phần tử, xoá hàng loạt gọi với mảng
// nhiều phần tử) — chỉ 1 lượt gọi Supabase Storage duy nhất (xem deleteLibraryImages ở
// lib/storage.ts) thay vì lặp N lượt riêng lẻ. Chỉ xoá được ảnh của chính mình — đối chiếu
// userId trong path (thư mục con {userId}/) với session hiện tại trước khi xoá thật, chặn 1
// seller xoá ảnh của seller khác dù biết/đoán được URL. Superadmin xoá được ảnh của bất kỳ ai
// (đúng tinh thần xem được tất cả ở listLibraryImages).
export async function removeLibraryImages(urls: string[]): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireAdmin();
  if (urls.length === 0) return { ok: false, error: "Chưa chọn ảnh nào." };

  const parsedList = urls.map((url) => parseLibraryImagePath(url));
  if (parsedList.some((p) => !p)) return { ok: false, error: "URL ảnh không hợp lệ." };
  if (session.user.role !== "SUPERADMIN" && parsedList.some((p) => p!.userId !== session.user.id)) {
    return { ok: false, error: "Bạn không có quyền xoá ảnh này." };
  }

  try {
    await deleteLibraryImages(parsedList.map((p) => p!.path));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Xoá ảnh thất bại." };
  }
  return { ok: true };
}

export async function removeLibraryImage(url: string): Promise<{ ok: true } | { ok: false; error: string }> {
  return removeLibraryImages([url]);
}
