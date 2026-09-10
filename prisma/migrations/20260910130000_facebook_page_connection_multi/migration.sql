-- Cho phép 1 seller kết nối NHIỀU fanpage Facebook (trước đây 1-1) — xem
-- FacebookPageConnection ở schema.prisma. pageId trở thành unique TOÀN HỆ THỐNG (thay cho
-- userId unique cũ) để 1 fanpage chỉ do đúng 1 seller quản lý.

DROP INDEX "FacebookPageConnection_userId_key";
DROP INDEX "FacebookPageConnection_pageId_idx";

CREATE UNIQUE INDEX "FacebookPageConnection_pageId_key" ON "FacebookPageConnection"("pageId");
CREATE INDEX "FacebookPageConnection_userId_idx" ON "FacebookPageConnection"("userId");
