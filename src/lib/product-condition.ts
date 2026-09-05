// Tình trạng sản phẩm — chỉ 2 lựa chọn cố định ở form đăng/sửa 1 sản phẩm (ProductForm.tsx).
// Riêng kênh import hàng loạt (product-import.ts) vẫn nhận free text để không bó buộc dữ liệu
// dán từ file Excel có sẵn của người bán.
export const PRODUCT_CONDITIONS = ["Mới", "Đã sử dụng"] as const;
export type ProductCondition = (typeof PRODUCT_CONDITIONS)[number];
