-- Gắn nhóm Facebook đã tìm được (và nhật ký tìm kiếm) vào từng tài khoản — trước đây
-- dùng chung cho cả sàn, giờ "nhóm của tài khoản nào chỉ tài khoản đó thấy".

ALTER TABLE "FacebookGroup" ADD COLUMN "userId" TEXT;
ALTER TABLE "FacebookKeywordSearch" ADD COLUMN "userId" TEXT;

-- Dữ liệu cũ (trước khi có scoping) không có chủ sở hữu -> gán về superadmin đầu tiên
-- (tài khoản vận hành sàn), giống cách đã backfill Product.sellerId trước đây.
UPDATE "FacebookGroup" SET "userId" = (SELECT "id" FROM "User" WHERE "role" = 'SUPERADMIN' ORDER BY "createdAt" ASC LIMIT 1) WHERE "userId" IS NULL;
UPDATE "FacebookKeywordSearch" SET "userId" = (SELECT "id" FROM "User" WHERE "role" = 'SUPERADMIN' ORDER BY "createdAt" ASC LIMIT 1) WHERE "userId" IS NULL;

ALTER TABLE "FacebookGroup" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "FacebookKeywordSearch" ALTER COLUMN "userId" SET NOT NULL;

ALTER TABLE "FacebookGroup" ADD CONSTRAINT "FacebookGroup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FacebookKeywordSearch" ADD CONSTRAINT "FacebookKeywordSearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- fbId một mình không còn unique — 2 tài khoản khác nhau được phép cùng có bản ghi cho
-- cùng 1 nhóm Facebook thật, chỉ unique trong phạm vi 1 tài khoản.
DROP INDEX "FacebookGroup_fbId_key";
CREATE UNIQUE INDEX "FacebookGroup_fbId_userId_key" ON "FacebookGroup"("fbId", "userId");

DROP INDEX "FacebookGroup_lastSeenAt_idx";
CREATE INDEX "FacebookGroup_userId_lastSeenAt_idx" ON "FacebookGroup"("userId", "lastSeenAt");

DROP INDEX "FacebookKeywordSearch_keyword_searchedAt_idx";
CREATE INDEX "FacebookKeywordSearch_userId_keyword_searchedAt_idx" ON "FacebookKeywordSearch"("userId", "keyword", "searchedAt");
