-- Kênh nhắn tin riêng giữa 1 seller và (các) superadmin để xin hỗ trợ về 1 tính năng nào đó
-- trên trang admin (xem SupportThread, SupportMessage ở schema.prisma) — khác ChatSession/
-- ChatMessage (khách vãng lai công khai nhắn hỏi mua hàng).

CREATE TYPE "SupportSender" AS ENUM ('SELLER', 'SUPERADMIN');

CREATE TABLE "SupportThread" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportThread_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupportThread_sellerId_key" ON "SupportThread"("sellerId");

CREATE INDEX "SupportThread_updatedAt_idx" ON "SupportThread"("updatedAt");

ALTER TABLE "SupportThread" ADD CONSTRAINT "SupportThread_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "sender" "SupportSender" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportMessage_threadId_createdAt_idx" ON "SupportMessage"("threadId", "createdAt");

ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "SupportThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
