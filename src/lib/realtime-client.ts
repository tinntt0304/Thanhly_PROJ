"use client";

import { useEffect, useRef } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null | undefined;

// Singleton — tránh mở nhiều kết nối realtime song song nếu nhiều component cùng dùng hook
// bên dưới trên 1 trang. `undefined` = chưa thử tạo, `null` = đã thử nhưng thiếu env (tắt
// tính năng), tách 2 trạng thái để không thử tạo lại mỗi lần gọi khi thật sự chưa cấu hình.
function getSupabaseBrowserClient(): SupabaseClient | null {
  if (cachedClient !== undefined) return cachedClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  cachedClient = url && anonKey ? createClient(url, anonKey) : null;
  return cachedClient;
}

// Lắng nghe 1 sự kiện Supabase Realtime Broadcast trên 1 kênh — dùng làm "tiếng chuông" để
// gọi lại Server Action lấy dữ liệu mới ngay khi có, thay vì chỉ chờ tới lượt poll định kỳ
// tiếp theo. `channelName` = null nghĩa là chưa có gì để lắng nghe (vd. chưa chọn hội thoại).
// Nếu chưa cấu hình NEXT_PUBLIC_SUPABASE_URL/ANON_KEY thì hook này không làm gì cả — polling
// định kỳ ở nơi gọi vẫn hoạt động bình thường, chỉ mất phần đẩy tức thời.
export function useRealtimeBroadcast(channelName: string | null, event: string, onEvent: () => void) {
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!channelName) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      console.warn("[realtime] Chưa cấu hình NEXT_PUBLIC_SUPABASE_URL/ANON_KEY — chỉ chạy polling.");
      return;
    }

    const channel = supabase
      .channel(channelName)
      .on("broadcast", { event }, () => {
        console.log(`[realtime] Nhận sự kiện "${event}" trên kênh "${channelName}"`);
        onEventRef.current();
      })
      .subscribe((status, err) => {
        console.log(`[realtime] Kênh "${channelName}" -> ${status}`, err ?? "");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelName, event]);
}
