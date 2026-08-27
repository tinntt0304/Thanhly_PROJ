// next/image chỉ tối ưu được (resize/nén) domain đã khai báo trong images.remotePatterns
// (next.config.ts) — hiện chỉ có domain Supabase Storage của dự án. Ảnh domain khác (dữ
// liệu cũ/nhập tay không qua flow upload chuẩn) vẫn phải hiển thị được, không được để
// next/image ném lỗi làm crash cả trang — chỉ bỏ qua bước tối ưu cho riêng ảnh đó.
export function isOptimizableProductImage(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".supabase.co");
  } catch {
    return false;
  }
}
