import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  formatDateTime,
  formatVND,
  getAuctionState,
  getWinningBid,
  maskPhone,
  minNextBid,
} from "@/lib/auction";
import { StatusBadge } from "@/components/StatusBadge";
import { Countdown } from "@/components/Countdown";
import { BidForm } from "@/components/BidForm";
import { asAttributes } from "@/lib/attributes";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: PageProps<"/products/[id]">) {
  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    include: { bids: { orderBy: { createdAt: "desc" } } },
  });

  if (!product) notFound();

  const state = getAuctionState(product, product.bids.length > 0);
  const winningBid =
    state === "ENDED_AWAITING_CONTACT" || state === "SOLD" ? getWinningBid(product.bids) : null;
  const attributes = asAttributes(product.attributes);

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-800">
          ← Quay lại danh sách
        </Link>

        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-neutral-100">
              {product.images[0] ? (
                <Image
                  src={product.images[0]}
                  alt={product.title}
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : null}
            </div>
            {product.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {product.images.slice(1).map((src, i) => (
                  <div
                    key={i}
                    className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-neutral-100"
                  >
                    <Image src={src} alt="" fill className="object-cover" unoptimized />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <StatusBadge state={state} />
            <h1 className="text-xl font-semibold">{product.title}</h1>
            <p className="text-sm text-neutral-500">Tình trạng: {product.condition}</p>

            <div className="rounded-lg border border-neutral-200 bg-white p-4">
              <p className="text-sm text-neutral-500">Giá hiện tại</p>
              <p className="text-2xl font-bold">{formatVND(product.currentPrice)}</p>
              {state === "BIDDING" && (
                <p className="mt-1 text-sm">
                  Còn lại: <Countdown endTime={product.endTime.toISOString()} />
                </p>
              )}
              {product.buyNowPrice && state === "BIDDING" && (
                <p className="mt-1 text-sm text-neutral-500">
                  Mua ngay: {formatVND(product.buyNowPrice)}
                </p>
              )}
            </div>

            {state === "BIDDING" && (
              <BidForm productId={product.id} minAllowed={minNextBid(product)} />
            )}

            {state === "ENDED_AWAITING_CONTACT" && winningBid && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Phiên đấu giá đã kết thúc. Người thắng: {maskPhone(winningBid.phone)} với giá{" "}
                {formatVND(winningBid.amount)}. Người bán sẽ sớm liên hệ để chốt đơn.
              </div>
            )}

            {state === "UNSOLD" && (
              <div className="rounded-lg border border-neutral-200 bg-neutral-100 p-4 text-sm text-neutral-600">
                Phiên đấu giá đã kết thúc mà không có lượt trả giá nào.
              </div>
            )}

            {state === "SOLD" && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                Sản phẩm này đã được bán.
              </div>
            )}

            {state === "CANCELLED" && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                Phiên đấu giá này đã bị huỷ.
              </div>
            )}
          </div>
        </div>

        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold">Mô tả</h2>
          <p className="whitespace-pre-line text-sm text-neutral-700">{product.description}</p>
        </div>

        {attributes.length > 0 && (
          <div className="mt-6">
            <h2 className="mb-2 text-sm font-semibold">Thuộc tính sản phẩm</h2>
            <dl className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white text-sm">
              {attributes.map((attr, i) => (
                <div key={i} className="flex justify-between px-4 py-2">
                  <dt className="text-neutral-500">{attr.name}</dt>
                  <dd className="font-medium text-neutral-800">{attr.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold">
            Lịch sử trả giá ({product.bids.length})
          </h2>
          {product.bids.length === 0 ? (
            <p className="text-sm text-neutral-500">Chưa có lượt trả giá nào.</p>
          ) : (
            <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
              {product.bids.map((bid) => (
                <li key={bid.id} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span className="text-neutral-500">{maskPhone(bid.phone)}</span>
                  <span className="font-medium">{formatVND(bid.amount)}</span>
                  <span className="text-xs text-neutral-400">{formatDateTime(bid.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
