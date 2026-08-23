export function HeroBanner({ defaultQuery = "" }: { defaultQuery?: string }) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-neutral-900 via-accent-700 to-accent-500">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-16 -top-24 h-72 w-72 rounded-full bg-accent-2-500/30 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-gold-400/30 blur-3xl"
      />

      <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-14 text-center sm:py-20">
        <h1 className="font-heading text-2xl font-bold text-white sm:text-4xl">
          Tìm sản phẩm thanh lý mẹ &amp; bé, thú cưng
        </h1>
        <p className="max-w-xl text-sm text-neutral-100 sm:text-base">
          Đấu giá minh bạch, trả giá bằng số điện thoại — không cần tạo tài khoản.
        </p>

        <form action="/" method="get" className="mt-2 flex w-full max-w-xl gap-2 rounded-xl bg-surface p-2 shadow-lg">
          <input
            type="search"
            name="q"
            defaultValue={defaultQuery}
            placeholder="Tìm sản phẩm theo tên..."
            aria-label="Tìm sản phẩm"
            className="min-w-0 flex-1 rounded-lg border-none bg-transparent px-3 py-2.5 text-sm text-text placeholder:text-neutral-500 focus:outline-none"
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-accent-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-600"
          >
            Tìm kiếm
          </button>
        </form>
      </div>
    </section>
  );
}
