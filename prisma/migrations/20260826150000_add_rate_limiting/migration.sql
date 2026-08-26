-- Chống spam/DoS tầng ứng dụng: chưa có gì giới hạn tần suất gọi các server action
-- (tìm nhóm Facebook, tạo yêu cầu nạp credit, đăng ký, đăng nhập) — 1 script tự động có
-- thể gọi liên tục không giới hạn vì server chưa kiểm tra tốc độ gọi ở đâu cả.

-- lastSearchAt: mốc thời gian lượt gọi Apify thật gần nhất của user — dùng để enforce
-- cooldown giữa 2 lượt tìm nhóm Facebook thật.
ALTER TABLE "User" ADD COLUMN "lastSearchAt" TIMESTAMP(3);

-- RateLimitHit: bộ đếm rate-limit dùng chung cho các hành động chưa có userId (đăng ký,
-- đăng nhập) — khoá theo IP/email tự do ở tầng ứng dụng, không phải dữ liệu nghiệp vụ.
CREATE TABLE "RateLimitHit" (
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "RateLimitHit_pkey" PRIMARY KEY ("key")
);
