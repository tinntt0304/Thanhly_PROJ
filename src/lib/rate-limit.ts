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
// Trả về true nếu còn trong hạn mức (cho phép), false nếu đã vượt (chặn).
export async function checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimitHit" (key, "windowStart", count)
    VALUES (${key}, now(), 1)
    ON CONFLICT (key) DO UPDATE SET
      count = CASE
        WHEN "RateLimitHit"."windowStart" < now() - (${windowSeconds}::text || ' seconds')::interval
        THEN 1
        ELSE "RateLimitHit".count + 1
      END,
      "windowStart" = CASE
        WHEN "RateLimitHit"."windowStart" < now() - (${windowSeconds}::text || ' seconds')::interval
        THEN now()
        ELSE "RateLimitHit"."windowStart"
      END
    RETURNING count;
  `;
  const count = rows[0]?.count ?? 1;
  return count <= limit;
}
