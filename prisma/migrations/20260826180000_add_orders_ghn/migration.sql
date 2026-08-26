-- Đơn hàng + tích hợp vận chuyển GHN (Giao Hàng Nhanh): tạo đơn từ sản phẩm đã bán, tạo
-- vận đơn GHN thật (bắt đầu ở môi trường sandbox, chuyển production khi có tài khoản
-- thật) và theo dõi trạng thái giao hàng.

CREATE TYPE "OrderStatus" AS ENUM ('NEW', 'SHIPPING', 'DELIVERED', 'CANCELLED');

CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "buyerName" TEXT NOT NULL,
    "buyerPhone" TEXT NOT NULL,
    "buyerAddress" TEXT NOT NULL,
    "provinceId" INTEGER NOT NULL,
    "provinceName" TEXT NOT NULL,
    "districtId" INTEGER NOT NULL,
    "districtName" TEXT NOT NULL,
    "wardCode" TEXT NOT NULL,
    "wardName" TEXT NOT NULL,
    "codAmount" INTEGER NOT NULL,
    "weightGram" INTEGER NOT NULL DEFAULT 500,
    "lengthCm" INTEGER NOT NULL DEFAULT 20,
    "widthCm" INTEGER NOT NULL DEFAULT 20,
    "heightCm" INTEGER NOT NULL DEFAULT 10,
    "note" TEXT,
    "shopPaysShipping" BOOLEAN NOT NULL DEFAULT false,
    "status" "OrderStatus" NOT NULL DEFAULT 'NEW',
    "ghnOrderCode" TEXT,
    "ghnStatus" TEXT,
    "shippingFee" INTEGER,
    "expectedDeliveryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Order_sellerId_status_idx" ON "Order"("sellerId", "status");
CREATE INDEX "Order_productId_idx" ON "Order"("productId");
CREATE INDEX "Order_ghnOrderCode_idx" ON "Order"("ghnOrderCode");

ALTER TABLE "Order" ADD CONSTRAINT "Order_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
