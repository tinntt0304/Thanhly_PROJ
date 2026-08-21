import type { Review } from "@/lib/reviews";

export function TrustBanner({
  avgRating,
  soldCount,
  reviews,
}: {
  avgRating: number;
  soldCount: number;
  reviews: Review[];
}) {
  return (
    <section className="border-b border-neutral-200 bg-white">
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-amber-500">★ {avgRating.toFixed(1)}</span>
            <span className="text-sm text-neutral-500">đánh giá trung bình</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">{soldCount.toLocaleString("vi-VN")}</span>
            <span className="text-sm text-neutral-500">đơn đã bán trên sàn cũ</span>
          </div>
        </div>

        {reviews.length > 0 && (
          <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
            {reviews.map((review, i) => (
              <div
                key={i}
                className="min-w-[220px] max-w-xs shrink-0 rounded-lg border border-neutral-200 bg-neutral-50 p-3"
              >
                <p className="text-sm text-neutral-700">&ldquo;{review.text}&rdquo;</p>
                <p className="mt-2 text-xs font-medium text-neutral-500">— {review.author}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
