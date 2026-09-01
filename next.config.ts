import type { NextConfig } from "next";

// Ảnh sản phẩm lưu ở Supabase Storage (URL tuyệt đối, khác domain) — next/image bắt buộc
// khai báo remotePatterns cho domain ngoài, nếu không sẽ trả 400 Bad Request. Trước đây
// né lỗi này bằng prop `unoptimized` ở ProductCard/ProductGallery, khiến ảnh gốc (tối đa
// 5MB/ảnh) được tải nguyên văn dù chỉ hiển thị dạng thumbnail nhỏ — giờ cấu hình đúng để
// next/image tự resize/nén theo kích thước hiển thị thật.
const supabaseHostname = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).hostname : undefined;

// Nguồn ảnh thật duy nhất ngoài chính domain của site — Supabase Storage. Không có domain
// ảnh ngoài nào khác (kể cả icon/favicon đều tự host qua next/font, next/image), nên CSP
// img-src chỉ cần liệt kê đúng 2 nguồn này.
const imgSrc = ["'self'", "data:", supabaseHostname ? `https://${supabaseHostname}` : ""]
  .filter(Boolean)
  .join(" ");

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
      "font-src 'self' data:",
      "connect-src 'self'",
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
