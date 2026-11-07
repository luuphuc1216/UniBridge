import Link from "next/link";

type UniBridgeLogoProps = {
  collapsed?: boolean;
  inverse?: boolean;
  size?: "compact" | "default" | "large";
  className?: string;
};

const sizeClasses = {
  compact: { mark: "size-8", wordmark: "text-sm", gap: "gap-2" },
  default: { mark: "size-9", wordmark: "text-base", gap: "gap-2.5" },
  large: { mark: "size-10", wordmark: "text-lg", gap: "gap-3" },
} as const;

export function UniBridgeLogo({
  collapsed = false,
  inverse = false,
  size = "default",
  className = "",
}: UniBridgeLogoProps) {
  const classes = sizeClasses[size];

  return (
    <Link
      aria-label="UniBridge - Trang chủ"
      className={`inline-flex min-w-0 items-center rounded-lg ${classes.gap} ${
        inverse ? "text-white" : "text-foreground"
      } ${
        inverse
          ? "focus-visible:ring-white focus-visible:ring-offset-brand-navy"
          : "focus-visible:ring-primary focus-visible:ring-offset-background"
      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-4 ${
        collapsed ? "justify-center" : ""
      } ${className}`}
      href="/"
    >
      <svg
        aria-hidden="true"
        className={`${classes.mark} shrink-0`}
        fill="none"
        viewBox="0 0 48 40"
      >
        <circle cx="13" cy="6" fill="var(--primary)" r="4" />
        <circle cx="35" cy="6" fill="var(--brand-light)" r="4" />
        <path
          d="M6 33V25C6 16.72 14.06 11 24 11s18 5.72 18 14v8M6 33h36M14 20v13m20-13v13"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.8"
        />
      </svg>
      <span
        className={`${classes.wordmark} whitespace-nowrap font-bold tracking-tight ${
          collapsed ? "sr-only" : ""
        }`}
      >
        UniBridge
      </span>
    </Link>
  );
}
