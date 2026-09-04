-- Tách Order thành Order (1 lượt giao hàng) + OrderItem (từng dòng sản phẩm trong đơn) — cho
-- phép gộp nhiều sản phẩm CÙNG 1 người bán vào 1 Order duy nhất khi checkout giỏ hàng, thay vì
-- luôn tạo 1 Order/sản phẩm như trước. Dữ liệu Order hiện có được di chuyển nguyên vẹn: mỗi
-- Order cũ (luôn đúng 1 sản phẩm) trở thành 1 Order + 1 OrderItem tương ứng, không mất dữ liệu.

CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "selectedAttributes" JSONB NOT NULL DEFAULT '[]',
    "stockDecremented" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Di chuyển dữ liệu: mỗi Order hiện có -> đúng 1 OrderItem (quantity luôn = 1 vì trước đây
-- Order chỉ gắn 1 sản phẩm/lần, unitPrice = codAmount vì tổng tiền cũ chính là giá 1 đơn vị đó).
INSERT INTO "OrderItem" ("id", "orderId", "productId", "quantity", "unitPrice", "selectedAttributes", "stockDecremented")
SELECT gen_random_uuid()::text, "id", "productId", 1, "codAmount", "selectedAttributes", "stockDecremented"
FROM "Order";

ALTER TABLE "Order" DROP CONSTRAINT "Order_productId_fkey";
DROP INDEX "Order_productId_idx";
ALTER TABLE "Order" DROP COLUMN "productId";
ALTER TABLE "Order" DROP COLUMN "selectedAttributes";
ALTER TABLE "Order" DROP COLUMN "stockDecremented";
