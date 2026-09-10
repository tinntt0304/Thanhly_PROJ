import type { NextConfig } from "next";

// Ảnh sản phẩm lưu ở Supabase Storage (URL tuyệt đối, khác domain) — next/image bắt buộc
// khai báo remotePatterns cho domain ngoài, nếu không sẽ trả 400 Bad Request. Trước đây
// né lỗi này bằng prop `unoptimized` ở ProductCard/ProductGallery, khiến ảnh gốc (tối đa
// 5MB/ảnh) được tải nguyên văn dù chỉ hiển thị dạng thumbnail nhỏ — giờ cấu hình đúng để
// next/image tự resize/nén theo kích thước hiển thị thật.
const supabaseHostname = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).hostname : undefined;

// Nguồn ảnh ngoài site: Supabase Storage (ảnh sản phẩm) + CDN của Facebook (ảnh đại diện
// người nhắn/bình luận ở tính năng Hộp thư Facebook, /admin/hop-thu-facebook) — 2 host CDN
// của Facebook trả về URL ảnh động (scontent-*.fbcdn.net, platform-lookaside.fbsbx.com) nên
// phải khai báo wildcard thay vì 1 hostname cố định.
const imgSrc = [
  "'self'",
  "data:",
  supabaseHostname ? `https://${supabaseHostname}` : "",
  "https://*.fbcdn.net",
  "https://platform-lookaside.fbsbx.com",
]
  .filter(Boolean)
  .join(" ");

// Trình duyệt kết nối REALTIME (WebSocket) thẳng tới Supabase để nhận broadcast (xem
// src/lib/realtime-client.ts) — connect-src mặc định chỉ 'self' sẽ ÂM THẦM chặn kết nối
// WebSocket này (CSP không throw lỗi JS bắt được, request chỉ đơn giản không bao giờ thành
// công), khiến client tưởng như đã "bật realtime" nhưng thực chất chưa từng kết nối được lấy
// nào cả, chỉ luôn rơi về polling — đã gặp thật (seller báo tin nhắn vẫn trễ ~15-20s dù đã
// cấu hình đủ biến môi trường và tối ưu tốc độ gửi phía server). Phải khai báo cả https:// (để
// polyfill/REST fallback của supabase-js) lẫn wss:// (kết nối WebSocket thật) cho đúng host.
const connectSrc = ["'self'", supabaseHostname ? `https://${supabaseHostname}` : "", supabaseHostname ? `wss://${supabaseHostname}` : ""]
  .filter(Boolean)
  .join(" ");

// Video/voice khách gửi qua Messenger (<video>/<audio>) đọc theo media-src, KHÔNG phải
// img-src — 2 directive riêng biệt trong CSP. Cùng 2 host CDN Facebook như img-src ở trên.
const mediaSrc = ["'self'", "https://*.fbcdn.net", "https://platform-lookaside.fbsbx.com"].join(" ");

// Chặn nhúng iframe (clickjacking, đặc biệt nhắm /admin/login) + hạn chế nguồn ảnh/font/
// connect chỉ còn chính site + Supabase Storage. script-src/style-src cần 'unsafe-inline':
// đã thử script-src 'self' nghiêm ngặt (không nonce) và xác nhận bằng Playwright — Next.js
// tự chèn script inline để hydrate (đẩy dữ liệu RSC qua self.__next_f.push(...)), thiếu
// 'unsafe-inline' làm hỏng hydration thật sự (React error #412) chứ không chỉ lý thuyết.
// CSP nonce-based đúng chuẩn cần thêm middleware.ts sinh nonce mỗi request — để sau nếu cần
// siết chặt hơn. Rủi ro thực tế của việc nới lỏng này thấp: toàn bộ codebase không có
// dangerouslySetInnerHTML nào (đã rà soát), nên chưa có điểm tiêm HTML/script từ dữ liệu
// người dùng để khai thác qua đường này. Giá trị chính của CSP ở đây là frame-ancestors
// (chặn clickjacking) + giới hạn nguồn ảnh/kết nối, không phải khoá script-src tuyệt đối.
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      `img-src ${imgSrc}`,
      `media-src ${mediaSrc}`,
      "font-src 'self' data:",
      `connect-src ${connectSrc}`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: supabaseHostname
      ? [
          {
            protocol: "https",
            hostname: supabaseHostname,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
  experimental: {
    serverActions: {
      // Đủ cho tối đa 8 ảnh x 5MB (giới hạn ở src/lib/product-limits.ts) + phần form còn lại.
      bodySizeLimit: "45mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
