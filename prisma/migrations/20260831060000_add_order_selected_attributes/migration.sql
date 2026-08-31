-- Thêm cột lưu thuộc tính người mua chọn khi bấm "Mua ngay" ở trang sản phẩm công khai.
ALTER TABLE "Order" ADD COLUMN "selectedAttributes" JSONB NOT NULL DEFAULT '[]';
