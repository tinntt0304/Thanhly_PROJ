-- Banner trang chủ dạng slideshow (nhiều ảnh, tự chuyển) — thay cho banner 1 ảnh cũ lưu ở
-- SiteContent(key="home_banner_image"). Backfill ảnh cũ (nếu có) làm ảnh đầu tiên, rồi dọn
-- dòng SiteContent cũ vì tính năng cũ không còn dùng nữa.

CREATE TABLE "HomeBannerConfig" (
    "key" TEXT NOT NULL,
    "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "intervalSeconds" INTEGER NOT NULL DEFAULT 5,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeBannerConfig_pkey" PRIMARY KEY ("key")
);

INSERT INTO "HomeBannerConfig" ("key", "images", "intervalSeconds", "updatedAt")
SELECT 'home_banner', ARRAY[content], 5, now()
FROM "SiteContent" WHERE key = 'home_banner_image';

DELETE FROM "SiteContent" WHERE key = 'home_banner_image';
