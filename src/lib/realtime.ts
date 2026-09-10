// Đẩy 1 sự kiện realtime qua Supabase Realtime Broadcast (kênh pub/sub tạm, KHÔNG phải
// Postgres CDC/RLS) — dùng làm "tiếng chuông" báo có tin nhắn mới, client nhận được thì tự
// gọi lại Server Action sẵn có (đã kiểm tra quyền đầy đủ) để lấy đúng dữ liệu. Chủ động không
// đẩy nội dung tin nhắn qua đây để không phải lo RLS/JWT cho kênh broadcast.
//
// Gửi qua REST API "broadcast" của Supabase (POST /realtime/v1/api/broadcast) thay vì mở kết
// nối WebSocket (channel.subscribe() rồi channel.send()) — bản WebSocket từng dùng ở đây phải
// bắt tay + đợi trạng thái SUBSCRIBED trước khi gửi được, mỗi lần gọi từ 1 serverless function
// nguội (không giữ kết nối giữa các lần invoke) tốn thêm 1-3+ giây chỉ để thiết lập kết nối —
// đúng nguyên nhân độ trễ vài giây "không tức thì" seller báo. Endpoint REST này nhận broadcast
// vào ĐÚNG cùng kênh mà client đang lắng nghe qua WebSocket, chỉ khác cách server GỬI vào, tốc
// độ ngang 1 lệnh fetch bình thường.
//
// Chưa cấu hình SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY thì coi như tắt tính năng (return sớm,
// không throw) — gửi tin nhắn vẫn phải thành công dù không đẩy được realtime, polling chậm ở
// client vẫn là lưới an toàn.
export async function broadcast(channel: string, event: string): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return;

  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ messages: [{ topic: channel, event, payload: {} }] }),
    });
  } catch {
    // Best-effort — lỗi mạng/Realtime service ở đây không nên chặn luồng chính (lưu tin
    // nhắn/gửi Send API vẫn phải coi là thành công dù không đẩy được realtime).
  }
}
