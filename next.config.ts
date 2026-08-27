import type { NextConfig } from "next";

// Ảnh sản phẩm lưu ở Supabase Storage (URL tuyệt đối, khác domain) — next/image bắt buộc
// khai báo remotePatterns cho domain ngoài, nếu không sẽ trả 400 Bad Request. Trước đây
// né lỗi này bằng prop `unoptimized` ở ProductCard/ProductGallery, khiến ảnh gốc (tối đa
// 5MB/ảnh) được tải nguyên văn dù chỉ hiển thị dạng thumbnail nhỏ — giờ cấu hình đúng để
// next/image tự resize/nén theo kích thước hiển thị thật.
const supabaseHostname = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).hostname : undefined;

const nextConfig: NextConfig = {
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
};

export default nextConfig;
