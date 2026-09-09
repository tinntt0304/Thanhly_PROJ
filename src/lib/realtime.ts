import { createClient } from "@supabase/supabase-js";

// Đẩy 1 sự kiện realtime qua Supabase Realtime Broadcast (kênh pub/sub tạm, KHÔNG phải
// Postgres CDC/RLS) — dùng làm "tiếng chuông" báo có tin nhắn mới, client nhận được thì tự
// gọi lại Server Action sẵn có (đã kiểm tra quyền đầy đủ) để lấy đúng dữ liệu. Chủ động không
// đẩy nội dung tin nhắn qua đây để không phải lo RLS/JWT cho kênh broadcast.
//
// Chưa cấu hình SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY thì coi như tắt tính năng (return sớm,
// không throw) — gửi tin nhắn vẫn phải thành công dù không đẩy được realtime, polling chậm ở
// client vẫn là lưới an toàn.
export async function broadcast(channel: string, event: string): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return;

  const client = createClient(url, serviceKey);
  const ch = client.channel(channel);

  try {
    await Promise.race([
      new Promise<void>((resolve) => {
        ch.subscribe((status) => {
          if (status === "SUBSCRIBED") {
            ch.send({ type: "broadcast", event, payload: {} }).finally(resolve);
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            resolve();
          }
        });
      }),
      // Realtime service chậm/không tới được thì bỏ qua sau vài giây, không treo Server Action.
      new Promise<void>((resolve) => setTimeout(resolve, 4000)),
    ]);
  } finally {
    await client.removeChannel(ch);
  }
}
