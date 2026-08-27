import Image from "next/image";
import Link from "next/link";
import type { HomeCardProduct } from "@/lib/auction";
import { formatVND, getAuctionState } from "@/lib/auction";
import { isOptimizableProductImage } from "@/lib/image-url";
import { StatusBadge } from "@/components/StatusBadge";
import { Countdown } from "@/components/Countdown";
import { TagBadges } from "@/components/TagBadges";

export function ProductCard({
  product,
  bidCount,
}: {
  product: HomeCardProduct;
  bidCount: number;
}) {
  const state = getAuctionState(product, bidCount > 0);

  return (
    <Link
      href={`/products/${product.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-surface shadow-sm transition hover:shadow-md"
    >
      <div className="relative aspect-square w-full bg-neutral-100">
        {product.tags.length > 0 && (
          <TagBadges tags={product.tags} className="absolute left-2 top-2 z-10" />
        )}
        {product.images[0] ? (
          <Image
            src={product.images[0]}
            alt={product.title}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover transition group-hover:scale-[1.02]"
            unoptimized={!isOptimizableProductImage(product.images[0])}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-neutral-500">
            Không có ảnh
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 font-heading text-sm font-medium text-text">
            {product.title}
          </h3>
        </div>
        <StatusBadge state={state} />
        <div className="mt-auto flex flex-col gap-1">
          <p className="text-lg font-semibold text-text">{formatVND(product.currentPrice)}</p>
          <p className="text-xs text-neutral-700">
            {bidCount} lượt trả giá ·{" "}
            {state === "BIDDING" ? <Countdown endTime={product.endTime.toISOString()} /> : "—"}
          </p>
        </div>
      </div>
    </Link>
  );
}
