"use client";

import { useState } from "react";

export function BusinessLogo({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      alt={alt}
      className="h-16 w-16 rounded-xl border border-border object-contain"
      onError={() => setFailed(true)}
      referrerPolicy="no-referrer"
      src={src}
    />
  );
}
