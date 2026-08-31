// Tách riêng khỏi actions/image-library.ts ("use server") — file đó chỉ được export
// async function (Next.js Server Actions), export thêm 1 const thường sẽ làm cả module mất
// hết export khi build (xác nhận thật qua lỗi build). Dùng chung giữa server (so khớp lỗi để
// biết khi nào ngừng gọi tiếp) và client (ImageLibraryManager, hiện đúng câu này khi bị chặn).
export const TOO_MANY_UPLOADS_ERROR =
  "Bạn đã tải lên quá nhiều ảnh trong thời gian ngắn, vui lòng đợi vài phút rồi thử lại.";
