import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

// Lấy IP người gọi từ header do Vercel/proxy đặt (x-forwarded-for có thể chứa nhiều IP
// nối bằng dấu phẩy, IP thật của client luôn đứng đầu). Không có thì coi như "unknown"
// (mọi request thiếu header dùng chung 1 hạn mức — vẫn còn tốt hơn không giới hạn gì).
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwardedFor = h.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}

// Rate-limit dạng fixed-window, đếm ở DB (RateLimitHit) — dùng cho hành động CHƯA có
// userId để gắn cooldown vào (đăng ký, đăng nhập). 1 câu lệnh SQL duy nhất (INSERT ...
// ON CONFLICT) để atomic: 2 request đến gần như đồng thời vẫn tăng đếm đúng, không bị
// race condition kiểu đọc rồi ghi riêng lẻ.
// Trả về true nếu còn trong hạn mức (cho phép), false nếu đã vượt (chặn). weight (mặc định
// 1) cho hành động 1 lượt gọi có thể "nặng" hơn 1 đơn vị thật (vd. upload nhiều ảnh cùng lúc
// trong 1 request — đếm theo SỐ ẢNH chứ không phải số lượt gọi, tránh gửi ít lượt nhưng mỗi
// lượt kèm rất nhiều file để né hạn mức đếm theo lượt gọi).
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
  weight: number = 1
): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimitHit" (key, "windowStart", count)
    VALUES (${key}, now(), ${weight})
    ON CONFLICT (key) DO UPDATE SET
      count = CASE
        WHEN "RateLimitHit"."windowStart" < now() - (${windowSeconds}::text || ' seconds')::interval
        THEN ${weight}
        ELSE "RateLimitHit".count + ${weight}
      END,
      "windowStart" = CASE
        WHEN "RateLimitHit"."windowStart" < now() - (${windowSeconds}::text || ' seconds')::interval
        THEN now()
        ELSE "RateLimitHit"."windowStart"
      END
    RETURNING count;
  `;
  const count = rows[0]?.count ?? weight;
  return count <= limit;
}
