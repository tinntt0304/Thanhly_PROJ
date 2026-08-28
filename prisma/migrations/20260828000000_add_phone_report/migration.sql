-- Báo xấu SĐT người nhận — 1 seller báo 1 lần cho 1 SĐT, tính chung toàn sàn để cảnh báo
-- chéo giữa các seller (xem PhoneReport ở schema.prisma).

CREATE TABLE "PhoneReport" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhoneReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PhoneReport_phone_reporterId_key" ON "PhoneReport"("phone", "reporterId");
CREATE INDEX "PhoneReport_phone_idx" ON "PhoneReport"("phone");

ALTER TABLE "PhoneReport" ADD CONSTRAINT "PhoneReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
