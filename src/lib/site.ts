// Domain production cố định làm fallback vì repo không có NEXT_PUBLIC_SITE_URL — xem docs/SETUP.md.
const FALLBACK_SITE_URL = "https://thanhly-dau-gia-hifen.vercel.app";

export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL;
}
