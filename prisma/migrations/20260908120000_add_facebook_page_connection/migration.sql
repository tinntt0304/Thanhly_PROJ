-- Kết nối fanpage Facebook riêng của từng seller (xem FacebookPageConnection ở
-- schema.prisma) — dùng để lấy hội thoại Messenger + bình luận bài đăng qua Meta Graph API
-- ở /admin/hop-thu-facebook.

CREATE TABLE "FacebookPageConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "pageName" TEXT,
    "pageAccessToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacebookPageConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FacebookPageConnection_userId_key" ON "FacebookPageConnection"("userId");

ALTER TABLE "FacebookPageConnection" ADD CONSTRAINT "FacebookPageConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
