// Chuẩn hoá về đúng gốc "https://<ref>.supabase.co" — supabase-js tự nối thêm
// "/realtime/v1/websocket" phía sau khi kết nối Realtime, nên nếu biến môi trường lỡ dán dư
// path (vd. copy nhầm URL REST API "https://<ref>.supabase.co/rest/v1" ở trang Data API thay
// vì Project URL) thì URL WebSocket cuối cùng sẽ sai be bét kiểu ".../rest/v1/realtime/v1/
// websocket" — đã gặp thật, khiến WebSocket luôn "failed" ngay từ bước kết nối. Cắt về origin
// (protocol + host, bỏ mọi path/query/hash) để lỗi dán nhầm dạng này không còn phá được kết
// nối realtime.
export function normalizeSupabaseUrl(raw: string): string {
  try {
    return new URL(raw).origin;
  } catch {
    return raw;
  }
}
