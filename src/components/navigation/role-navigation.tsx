"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";

export type NavigationLink = {
  href: string;
  label: string;
};

type RoleNavigationProps = {
  title: string;
  links: NavigationLink[];
};

export function RoleNavigation({ title, links }: RoleNavigationProps) {
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <Link className="text-xl font-bold tracking-tight text-primary" href="/">
            UniBridge
          </Link>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary lg:hidden">
            {title}
          </span>
        </div>
        <nav aria-label={`Điều hướng ${title}`} className="flex flex-wrap items-center gap-2">
          {links.map((link) => (
            <Link
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
              href={link.href}
              key={link.href}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center justify-between gap-3 border-t border-border pt-3 lg:border-0 lg:pt-0">
          <span className="hidden rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary lg:inline-flex">
            {title}
          </span>
          <button
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium transition hover:bg-muted"
            onClick={() => signOut({ callbackUrl: "/" })}
            type="button"
          >
            Đăng xuất
          </button>
        </div>
      </div>
    </header>
  );
}
