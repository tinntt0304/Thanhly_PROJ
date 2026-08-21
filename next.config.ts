import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Đủ cho tối đa 8 ảnh x 5MB (giới hạn ở src/lib/product-limits.ts) + phần form còn lại.
      bodySizeLimit: "45mb",
    },
  },
};

export default nextConfig;
