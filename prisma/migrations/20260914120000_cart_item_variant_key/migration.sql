-- Phân biệt các phân loại (biến thể thuộc tính) khác nhau của CÙNG 1 sản phẩm trong giỏ hàng:
-- trước đây unique(buyerId, productId) khiến buyer thêm "Mẫu A" rồi thêm "Mẫu B" của cùng 1
-- sản phẩm bị gộp chung 1 dòng (số lượng cộng dồn sai, mất luôn lựa chọn thuộc tính trước đó).

ALTER TABLE "CartItem" ADD COLUMN "variantKey" TEXT NOT NULL DEFAULT '';

DROP INDEX "CartItem_buyerId_productId_key";

CREATE UNIQUE INDEX "CartItem_buyerId_productId_variantKey_key" ON "CartItem"("buyerId", "productId", "variantKey");
