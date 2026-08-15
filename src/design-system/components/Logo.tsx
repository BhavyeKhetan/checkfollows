import Link from "next/link";

/**
 * Official CheckFollows logo — black circle mark with a lime bolt,
 * next to the "CheckFollows" wordmark.
 *
 * This is the single source of truth for the brand mark. The bolt path
 * is identical to src/app/icon.svg, public/logo.svg, and the raster
 * assets (logo.png, icon.png, apple-icon.png, favicon.ico, og.png).
 */
const SIZES = {
  xs: { circle: "w-5 h-5", wordmark: "text-sm" },
  sm: { circle: "w-6 h-6", wordmark: "text-sm" },
  md: { circle: "w-8 h-8", wordmark: "text-xl" },
  lg: { circle: "w-10 h-10", wordmark: "text-2xl" },
} as const;

export type LogoSize = keyof typeof SIZES;

const BOLT_PATH = "M25 12 L13 26 L24 26 L23 36 L35 22 L24 22 L25 12 Z";

export function Logo({
  size = "md",
  showWordmark = true,
  href = "/",
  className = "",
}: {
  size?: LogoSize;
  showWordmark?: boolean;
  /** Pass a URL to render a link; omit to render a plain inline mark. */
  href?: string;
  className?: string;
}) {
  const s = SIZES[size];

  const content = (
    <>
      <svg
        viewBox="0 0 48 48"
        fill="none"
        className={`${s.circle} shrink-0`}
        aria-hidden="true"
      >
        <circle cx="24" cy="24" r="24" fill="#121212" />
        <path d={BOLT_PATH} fill="#E7F256" />
      </svg>
      {showWordmark && (
        <span className={`tracking-tight font-extrabold text-[#121212] ${s.wordmark}`}>
          CheckFollows
        </span>
      )}
    </>
  );

  const base = `inline-flex items-center gap-2.5 font-bold text-[#121212] ${className}`;

  if (href) {
    return (
      <Link
        href={href}
        className={`${base} hover:opacity-80 transition-opacity`}
        aria-label="CheckFollows home"
      >
        {content}
      </Link>
    );
  }

  return <span className={base}>{content}</span>;
}
