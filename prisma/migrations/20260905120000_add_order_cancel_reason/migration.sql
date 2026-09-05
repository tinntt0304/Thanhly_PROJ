-- Lý do huỷ đơn — chỉ ghi khi người mua tự huỷ (chọn preset hoặc "Lý do khác" ở /tai-khoan/don-hang).
ALTER TABLE "Order" ADD COLUMN "cancelReason" TEXT;
