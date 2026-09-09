-- Cache tin nhắn Messenger + tên/ảnh khách theo từng fanpage (xem FacebookMessage,
-- FacebookParticipant ở schema.prisma) — đổ dữ liệu từ Webhook Facebook + backfill Graph API,
-- dùng làm nguồn đọc chính cho /admin/hop-thu-facebook thay vì gọi Graph API mỗi lần xem.

CREATE TYPE "FacebookMessageDirection" AS ENUM ('IN', 'OUT');

CREATE TABLE "FacebookMessage" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "psid" TEXT NOT NULL,
    "direction" "FacebookMessageDirection" NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacebookMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FacebookMessage_pageId_psid_createdAt_idx" ON "FacebookMessage"("pageId", "psid", "createdAt");

CREATE TABLE "FacebookParticipant" (
    "pageId" TEXT NOT NULL,
    "psid" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacebookParticipant_pkey" PRIMARY KEY ("pageId", "psid")
);
