-- Mã đơn hàng ngắn, tăng dần (hiển thị "HF000123", xem formatOrderCode ở lib/orders.ts) — thêm
-- cột nullable trước, backfill đơn hàng cũ theo đúng thứ tự tạo (đơn cũ nhất -> mã nhỏ nhất),
-- rồi mới gắn sequence + NOT NULL + unique cho các đơn tạo mới về sau.

ALTER TABLE "Order" ADD COLUMN "orderSeq" INTEGER;

WITH numbered AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) AS rn
  FROM "Order"
)
UPDATE "Order" o
SET "orderSeq" = numbered.rn
FROM numbered
WHERE o."id" = numbered."id";

CREATE SEQUENCE "Order_orderSeq_seq" OWNED BY "Order"."orderSeq";
SELECT setval('"Order_orderSeq_seq"', COALESCE((SELECT MAX("orderSeq") FROM "Order"), 0));
ALTER TABLE "Order" ALTER COLUMN "orderSeq" SET DEFAULT nextval('"Order_orderSeq_seq"');
ALTER TABLE "Order" ALTER COLUMN "orderSeq" SET NOT NULL;
CREATE UNIQUE INDEX "Order_orderSeq_key" ON "Order"("orderSeq");
