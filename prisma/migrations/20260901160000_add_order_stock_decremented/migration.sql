-- Đánh dấu đơn nào đã trừ kho (Product.quantity) lúc tạo — dùng để hoàn lại đúng khi huỷ đơn.
ALTER TABLE "Order" ADD COLUMN "stockDecremented" BOOLEAN NOT NULL DEFAULT false;
