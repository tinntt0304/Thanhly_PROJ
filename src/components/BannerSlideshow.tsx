"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { isOptimizableProductImage } from "@/lib/image-url";

// Nền ảnh của HeroBanner — tự chuyển slide bằng crossfade opacity (không cần thư viện
// carousel ngoài, phù hợp quy mô 1 banner/trang chủ). setState nằm trong callback của
// setInterval (không đồng bộ trong thân effect) nên không vi phạm rule set-state-in-effect.
export function BannerSlideshow({
  images,
  intervalSeconds,
}: {
  images: string[];
  intervalSeconds: number;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % images.length);
    }, Math.max(1, intervalSeconds) * 1000);
    return () => clearInterval(id);
  }, [images.length, intervalSeconds]);

  if (images.length === 0) return null;

  return (
    <>
      {images.map((src, i) => (
        <Image
          key={src}
          src={src}
          alt=""
          fill
          priority={i === 0}
          sizes="100vw"
          className={`object-cover transition-opacity duration-1000 ${i === index ? "opacity-100" : "opacity-0"}`}
          unoptimized={!isOptimizableProductImage(src)}
        />
      ))}
      {/* Phủ tối để chữ + ô tìm kiếm luôn đọc được dù ảnh banner sáng màu */}
      <div aria-hidden="true" className="absolute inset-0 bg-black/40" />
    </>
  );
}
