-- Bỏ tài khoản người mua riêng (Buyer) — dùng chung 1 tài khoản User (SELLER/SUPERADMIN, đăng
-- ký/đăng nhập ở /admin/register, /admin/login) cho cả bán lẫn mua. Tại thời điểm migrate:
-- CartItem/Order.buyerId/Bid.buyerId đều chưa có dòng nào tham chiếu tới Buyer (tính năng vừa
-- thêm, chưa có dữ liệu thật) nên trỏ lại FK sang User an toàn, không mất dữ liệu.

ALTER TABLE "CartItem" DROP CONSTRAINT "CartItem_buyerId_fkey";
ALTER TABLE "Order" DROP CONSTRAINT "Order_buyerId_fkey";
ALTER TABLE "Bid" DROP CONSTRAINT "Bid_buyerId_fkey";

DROP TABLE "Buyer";

ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
