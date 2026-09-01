// Hằng số dùng chung giữa client (ProductForm) và server (storage.ts) — tách riêng
// để component client không phải import "@supabase/supabase-js" chỉ để lấy 2 con số.
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB / ảnh
export const MAX_IMAGES_PER_PRODUCT = 8;
export const MAX_BANNER_IMAGES = 8; // banner trang chủ dạng slideshow (/admin/danh-muc)

// File Excel import sản phẩm (product-import.ts) chỉ chứa text + số, không có lý do gì
// nặng — giới hạn riêng, nhỏ hơn hẳn mức 45mb chung của Server Actions (dành cho ảnh),
// tránh 1 file .xlsx nén tốt nhưng phình to bất thường lúc ExcelJS giải nén vào bộ nhớ.
export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024; // 5MB
// Chặn 1 file quá nhiều dòng khiến vòng lặp insert tuần tự (không Promise.all, xem
// product-import.ts) chạy quá lâu, có nguy cơ vượt timeout của serverless function.
export const MAX_IMPORT_ROWS = 500;
