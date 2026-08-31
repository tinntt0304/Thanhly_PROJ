"use client";

// Nén/resize ảnh NGAY TRONG TRÌNH DUYỆT trước khi upload. Đo thật trên production: server xử
// lý (nén qua sharp + ghi lên Supabase Storage) 1 ảnh ~3.8MB chỉ mất ~1.2 giây — nhưng tổng
// thời gian người dùng thấy là ~110 GIÂY, vì phần lớn thời gian đó là TRUYỀN file gốc (vài MB)
// qua đường TẢI LÊN của người dùng (upload thường chậm hơn hẳn download trên mạng gia đình/di
// động). Nén trước ngay trong trình duyệt (xuống còn ~10-15% dung lượng gốc, tương tự mức nén
// server đang làm) cắt gần hết phần thời gian này TRƯỚC KHI dữ liệu rời khỏi máy người dùng.
// Server vẫn nén lại 1 lần nữa (lib/storage.ts) làm lưới an toàn — không tin dữ liệu từ
// client, và ảnh gửi thẳng qua API (bỏ qua UI) vẫn được xử lý đúng.
const MAX_DIMENSION = 1920; // khớp MAX_IMAGE_DIMENSION ở lib/storage.ts
const WEBP_QUALITY = 0.8;

export async function compressImageForUpload(file: File): Promise<File> {
  // GIF giữ nguyên — canvas chỉ vẽ được frame đầu, nén sẽ làm mất hoạt ảnh (lý do y hệt phía
  // server, xem compressImage ở lib/storage.ts).
  if (file.type === "image/gif") return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", WEBP_QUALITY));
    // Nén ra lớn hơn bản gốc (hiếm, vd ảnh đã nén sẵn rất kỹ) thì dùng bản gốc cho chắc.
    if (!blob || blob.size >= file.size) return file;

    const newName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
    return new File([blob], newName, { type: "image/webp" });
  } catch {
    // Trình duyệt không hỗ trợ createImageBitmap/canvas.toBlob, hoặc ảnh lỗi — gửi bản gốc,
    // server vẫn nén lại nên không mất tính năng, chỉ mất phần tăng tốc này.
    return file;
  }
}
