import Link from "next/link";

type IconVariant = "primary" | "reversed" | "mono";

const ICON_FILLS: Record<IconVariant, { badge: string; bar: string; dot: string }> = {
  primary: { badge: "#f3e6c9", bar: "#5c6a44", dot: "#c67139" },
  reversed: { badge: "none", bar: "var(--color-bg)", dot: "var(--color-accent-300)" },
  mono: { badge: "var(--color-neutral-900)", bar: "var(--color-bg)", dot: "var(--color-bg)" },
};

export function LogoIcon({
  size = 40,
  variant = "primary",
  className,
}: {
  size?: number;
  variant?: IconVariant;
  className?: string;
}) {
  const fills = ICON_FILLS[variant];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect x="2" y="2" width="60" height="60" rx="20" fill={fills.badge} />
      <rect x="14" y="29" width="30" height="10" rx="5" fill={fills.bar} />
      <circle cx="47" cy="18" r="7" fill={fills.dot} />
    </svg>
  );
}

const SIZE_PRESETS = {
  sm: { icon: 40, wordmark: 24, gap: 12 },
  lg: { icon: 72, wordmark: 44, gap: 24 },
} as const;

export function Logo({
  size = "sm",
  withTagline = false,
  href = "/",
}: {
  size?: keyof typeof SIZE_PRESETS;
  withTagline?: boolean;
  href?: string | null;
}) {
  const preset = SIZE_PRESETS[size];

  const content = (
    <div className="flex items-center" style={{ gap: preset.gap }}>
      <LogoIcon size={preset.icon} />
      <div className="flex flex-col" style={{ gap: 4 }}>
        <span
          className="font-wordmark leading-none text-text"
          style={{ fontSize: preset.wordmark }}
        >
          hifen
        </span>
        {withTagline && (
          <span
            className="font-body text-neutral-700"
            style={{ fontSize: 15, letterSpacing: "0.02em" }}
          >
            đồ mẹ &amp; bé · thú cưng thanh lý
          </span>
        )}
      </div>
    </div>
  );

  if (!href) return content;
  return (
    <Link href={href} className="inline-flex">
      {content}
    </Link>
  );
}
