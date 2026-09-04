import { cache } from "react";
import type { Metadata } from "next";
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
import { BuyNowButton } from "@/components/BuyNowButton";
import { AddToCartButton } from "@/components/AddToCartButton";
import { asAttributes } from "@/lib/attributes";
import { ProductGallery } from "@/components/ProductGallery";
import { TagBadges } from "@/components/TagBadges";
import { ChatWidget } from "@/components/ChatWidget";
import { SiteHeader } from "@/components/SiteHeader";
import { ShareButtons } from "@/components/ShareButtons";
import { getSiteUrl } from "@/lib/site";
import { auth } from "@/lib/auth";

// cache() dedupe cùng 1 lượt fetch giữa generateMetadata() và component trang bên dưới
// trong cùng 1 request, tránh query Prisma 2 lần cho mỗi lượt xem trang sản phẩm.
const getProduct = cache((id: string) =>
  prisma.product.findUnique({
    where: { id },
    include: { bids: { orderBy: { createdAt: "desc" } } },
  })
);

export async function generateMetadata({
  params,
}: PageProps<"/products/[id]">): Promise<Metadata> {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) return {};

  const title = `${product.title} — hifen`;
  const description = `${product.description.slice(0, 150)} · Giá hiện tại: ${formatVND(product.currentPrice)}`;
  const url = `${getSiteUrl()}/products/${id}`;
  const image = product.images[0];

  return {
    title,
    description,
    openGraph: {
      type: "website",
      title,
      description,
      url,
      images: image ? [{ url: image }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: PageProps<"/products/[id]">) {
  const { id } = await params;

  const [product, session] = await Promise.all([getProduct(id), auth()]);

  if (!product) notFound();

  const state = getAuctionState(product, product.bids.length > 0);
  const winningBid =
    state === "ENDED_AWAITING_CONTACT" || state === "SOLD" ? getWinningBid(product.bids) : null;
  const attributes = asAttributes(product.attributes);

  return (
    <main className="flex-1">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-4 py-6">
        <Link href="/" className="text-sm text-neutral-700 hover:text-text">
          ← Quay lại danh sách
        </Link>

        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <ProductGallery images={product.images} title={product.title} />

          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge state={state} />
              <TagBadges tags={product.tags} />
            </div>
            <h1 className="font-heading text-xl font-bold text-text">{product.title}</h1>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-accent-2-100 px-3 py-1.5 text-sm font-semibold text-accent-2-700">
                <span aria-hidden="true">🏷️</span> Tình trạng: {product.condition}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md bg-accent-100 px-3 py-1.5 text-sm font-semibold text-accent-700">
                <span aria-hidden="true">📦</span> Số lượng: {product.quantity}
              </span>
            </div>

            <ShareButtons url={`${getSiteUrl()}/products/${product.id}`} title={product.title} />

            {/* Mua ngay đặt TRƯỚC, tách hẳn khỏi khối đấu giá bên dưới — 2 lối mua độc lập,
                không phải Mua ngay là 1 bước "sau khi đã đấu giá". */}
            {product.buyNowPrice && (
              <div className="flex flex-col gap-2">
                <BuyNowButton
                  productId={product.id}
                  buyNowPrice={product.buyNowPrice}
                  attributes={attributes}
                  canBuy={state === "BIDDING"}
                  defaultBuyerName={session?.user.name ?? undefined}
                  defaultBuyerPhone={session?.user.phone ?? undefined}
                />
                <AddToCartButton
                  productId={product.id}
                  attributes={attributes}
                  canBuy={state === "BIDDING"}
                  isLoggedIn={!!session}
                />
              </div>
            )}

            {product.buyNowPrice && state === "BIDDING" && (
              <div className="flex items-center gap-3 text-xs font-medium text-neutral-400">
                <span className="h-px flex-1 bg-neutral-200" />
                HOẶC ĐẤU GIÁ
                <span className="h-px flex-1 bg-neutral-200" />
              </div>
            )}

            <div className="rounded-lg border border-neutral-200 bg-surface p-4">
              <p className="text-sm text-neutral-700">Giá đấu giá hiện tại</p>
              <p className="font-heading text-2xl font-bold text-text">
                {formatVND(product.currentPrice)}
              </p>
              {state === "BIDDING" && (
                <p className="mt-1 text-sm">
                  Còn lại: <Countdown endTime={product.endTime.toISOString()} />
                </p>
              )}
            </div>

            {state === "BIDDING" && (
              <BidForm productId={product.id} minAllowed={minNextBid(product)} />
            )}

            {state === "ENDED_AWAITING_CONTACT" && winningBid && (
              <div className="rounded-lg border border-accent-300 bg-accent-100 p-4 text-sm text-accent-700">
                Phiên đấu giá đã kết thúc. Người thắng: {maskPhone(winningBid.phone)} với giá{" "}
                {formatVND(winningBid.amount)}. Người bán sẽ sớm liên hệ để chốt đơn.
              </div>
            )}

            {state === "UNSOLD" && (
              <div className="rounded-lg border border-neutral-200 bg-neutral-100 p-4 text-sm text-neutral-700">
                Phiên đấu giá đã kết thúc mà không có lượt trả giá nào.
              </div>
            )}

            {state === "SOLD" && (
              <div className="rounded-lg border border-neutral-300 bg-neutral-800 p-4 text-sm text-neutral-50">
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
          <h2 className="mb-2 font-heading text-sm font-bold text-text">Mô tả</h2>
          <p className="whitespace-pre-line text-sm text-neutral-800">{product.description}</p>
        </div>

        {attributes.length > 0 && (
          <div className="mt-6">
            <h2 className="mb-2 font-heading text-sm font-bold text-text">Thuộc tính sản phẩm</h2>
            <dl className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-surface text-sm">
              {attributes.map((attr, i) => (
                <div key={i} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                  <dt className="text-neutral-700">{attr.name}</dt>
                  <dd className="flex flex-wrap justify-end gap-1.5">
                    {attr.values.map((val, vi) => (
                      <span
                        key={val + vi}
                        className="inline-flex items-center rounded-full bg-accent-2-100 px-2.5 py-0.5 text-xs font-medium text-accent-2-700"
                      >
                        {val}
                      </span>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <div className="mt-6">
          <h2 className="mb-2 font-heading text-sm font-bold text-text">
            Lịch sử trả giá ({product.bids.length})
          </h2>
          {product.bids.length === 0 ? (
            <p className="text-sm text-neutral-700">Chưa có lượt trả giá nào.</p>
          ) : (
            <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-surface">
              {product.bids.map((bid) => (
                <li key={bid.id} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span className="text-neutral-700">{maskPhone(bid.phone)}</span>
                  <span className="font-medium text-text">{formatVND(bid.amount)}</span>
                  <span className="text-xs text-neutral-500">{formatDateTime(bid.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <ChatWidget />
    </main>
  );
}
