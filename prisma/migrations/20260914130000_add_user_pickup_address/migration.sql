-- Địa chỉ lấy hàng cho GHN — cấu hình theo từng seller ở /admin/cai-dat, thay cho biến môi
-- trường GHN_FROM_* dùng chung 1 địa chỉ cho toàn sàn trước đây.

ALTER TABLE "User" ADD COLUMN "pickupName" TEXT;
ALTER TABLE "User" ADD COLUMN "pickupPhone" TEXT;
ALTER TABLE "User" ADD COLUMN "pickupAddress" TEXT;
ALTER TABLE "User" ADD COLUMN "pickupProvinceId" INTEGER;
ALTER TABLE "User" ADD COLUMN "pickupProvinceName" TEXT;
ALTER TABLE "User" ADD COLUMN "pickupDistrictId" INTEGER;
ALTER TABLE "User" ADD COLUMN "pickupDistrictName" TEXT;
ALTER TABLE "User" ADD COLUMN "pickupWardCode" TEXT;
ALTER TABLE "User" ADD COLUMN "pickupWardName" TEXT;
