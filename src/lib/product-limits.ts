// Hằng số dùng chung giữa client (ProductForm) và server (storage.ts) — tách riêng
// để component client không phải import "@supabase/supabase-js" chỉ để lấy 2 con số.
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB / ảnh
export const MAX_IMAGES_PER_PRODUCT = 8;
