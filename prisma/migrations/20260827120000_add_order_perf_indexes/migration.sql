-- Thêm index cho các tab lọc đơn hàng mới ở /admin/orders (theo ghnStatus và theo
-- khoảng ngày tạo) — chưa có gì trước đây, sẽ full scan khi bảng Order lớn dần.

CREATE INDEX "Order_ghnStatus_idx" ON "Order"("ghnStatus");
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");
