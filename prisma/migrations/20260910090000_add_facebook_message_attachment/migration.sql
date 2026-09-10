-- Lưu URL đính kèm (ảnh/video/voice) của tin nhắn Messenger — xem FacebookMessage ở
-- schema.prisma. Hiển thị trực tiếp thay vì chỉ nhãn chữ "Đã gửi hình ảnh...".

CREATE TYPE "FacebookAttachmentType" AS ENUM ('IMAGE', 'VIDEO', 'AUDIO', 'FILE');

ALTER TABLE "FacebookMessage" ADD COLUMN "attachmentType" "FacebookAttachmentType";
ALTER TABLE "FacebookMessage" ADD COLUMN "attachmentUrl" TEXT;
