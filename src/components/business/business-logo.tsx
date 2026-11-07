"use client";

import Image from "next/image";
import { useState } from "react";

export function BusinessLogo({
  src,
  alt,
  showFallback = false,
}: {
  src: string;
  alt: string;
  showFallback?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    if (!showFallback) return null;
    return (
      <div
        aria-label={alt}
        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/50 text-muted-foreground"
        role="img"
      >
        <svg
          aria-hidden="true"
          className="h-9 w-9"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            d="M3 21h18M5 21V7l7-4 7 4v14M9 10h.01M15 10h.01M9 14h.01M15 14h.01M10 21v-3h4v3"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.7"
          />
        </svg>
      </div>
    );
  }
  const resolvedSrc = /^[0-9a-f-]{36}$/i.test(src) ? `/api/business/logos/${src}` : src;
  const isExternalSource = !resolvedSrc.startsWith("/");
  // External logo hosts are not restricted to a fixed domain, so avoid broadening Next's image allowlist.
  return (
    <Image
      alt={alt}
      className="h-16 w-16 shrink-0 rounded-xl border border-border bg-card object-contain"
      height={64}
      onError={() => setFailed(true)}
      referrerPolicy="no-referrer"
      unoptimized={isExternalSource}
      src={resolvedSrc}
      width={64}
    />
  );
}
