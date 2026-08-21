"use client";

import { useState } from "react";
import Image from "next/image";

export function ProductGallery({ images, title }: { images: string[]; title: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeSrc = images[activeIndex];

  return (
    <div className="flex flex-col gap-2">
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-neutral-100">
        {activeSrc ? (
          <Image src={activeSrc} alt={title} fill className="object-cover" unoptimized priority />
        ) : null}
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {images.map((src, i) => (
            <button
              key={src + i}
              type="button"
              onClick={() => setActiveIndex(i)}
              aria-label={`Xem ảnh ${i + 1}`}
              aria-current={i === activeIndex}
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-neutral-100 ring-2 transition ${
                i === activeIndex ? "ring-accent-500" : "ring-transparent hover:ring-neutral-300"
              }`}
            >
              <Image src={src} alt="" fill className="object-cover" unoptimized />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
