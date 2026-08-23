-- Đổi bảng Admin (1 tài khoản duy nhất) thành User (nhiều vai trò) để chuẩn bị cho
-- nhiều người bán tự đăng ký tài khoản.
ALTER TABLE "Admin" RENAME TO "User";
ALTER TABLE "User" RENAME CONSTRAINT "Admin_pkey" TO "User_pkey";
ALTER INDEX "Admin_email_key" RENAME TO "User_email_key";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPERADMIN', 'SELLER');

ALTER TABLE "User" ADD COLUMN "name" TEXT NOT NULL DEFAULT 'Người bán';
ALTER TABLE "User" ADD COLUMN "phone" TEXT;
ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'SELLER';
ALTER TABLE "User" ALTER COLUMN "name" DROP DEFAULT;

-- Tài khoản admin gốc (seed từ .env trước đây) là người vận hành sàn -> nâng lên SUPERADMIN
UPDATE "User" SET "role" = 'SUPERADMIN';

-- Gắn sản phẩm với người bán
ALTER TABLE "Product" ADD COLUMN "sellerId" TEXT;
ALTER TABLE "Product" ADD CONSTRAINT "Product_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Sản phẩm cũ (trước khi có hệ thống nhiều người bán) gán về superadmin đầu tiên
UPDATE "Product" SET "sellerId" = (SELECT "id" FROM "User" WHERE "role" = 'SUPERADMIN' ORDER BY "createdAt" ASC LIMIT 1) WHERE "sellerId" IS NULL;

-- CreateTable
CREATE TABLE "NavItem" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NavItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteContent" (
    "key" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteContent_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Announcement_published_createdAt_idx" ON "Announcement"("published", "createdAt");
