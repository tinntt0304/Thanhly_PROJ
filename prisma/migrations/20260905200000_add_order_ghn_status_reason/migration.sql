-- Lý do thất bại GHN trả kèm ghnStatus (vd. "Khách không nghe máy") — chỉ webhook mới cung cấp.
ALTER TABLE "Order" ADD COLUMN "ghnStatusReason" TEXT;
