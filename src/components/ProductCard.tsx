import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/generated/prisma/client";
import { formatVND, getAuctionState } from "@/lib/auction";
import { StatusBadge } from "@/components/StatusBadge";
import { Countdown } from "@/components/Countdown";

export function ProductCard({
  product,
  bidCount,
}: {
  product: Product;
  bidCount: number;
}) {
  const state = getAuctionState(product, bidCount > 0);

  return (
    <Link
      href={`/products/${product.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm transition hover:shadow-md"
    >
      <div className="relative aspect-square w-full bg-neutral-100">
        {product.images[0] ? (
          <Image
            src={product.images[0]}
            alt={product.title}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover transition group-hover:scale-[1.02]"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center text-neutral-400">
            Không có ảnh
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-sm font-medium">{product.title}</h3>
        </div>
        <StatusBadge state={state} />
        <div className="mt-auto flex flex-col gap-1">
          <p className="text-lg font-semibold text-neutral-900">
            {formatVND(product.currentPrice)}
          </p>
          <p className="text-xs text-neutral-500">
            {bidCount} lượt trả giá ·{" "}
            {state === "BIDDING" ? <Countdown endTime={product.endTime.toISOString()} /> : "—"}
          </p>
        </div>
      </div>
    </Link>
  );
}
