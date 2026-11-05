"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Menu, X } from "lucide-react";

export type NavigationLink = {
  href: string;
  label: string;
};

type RoleNavigationProps = {
  title: string;
  links: NavigationLink[];
  tools?: ReactNode;
};

export function RoleNavigation({ title, links, tools }: RoleNavigationProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem("unibridge-sidebar-collapsed") === "true") {
      const frame = window.requestAnimationFrame(() => setCollapsed(true));
      return () => window.cancelAnimationFrame(frame);
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("unibridge-sidebar-collapsed", String(next));
      return next;
    });
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur sm:px-6 lg:ml-64 lg:px-8">
        <div className="flex items-center gap-3">
          <button
            aria-label="Mở menu điều hướng"
            className="inline-flex size-10 items-center justify-center rounded-xl border border-border text-foreground hover:bg-muted lg:hidden"
            onClick={() => setMobileOpen(true)}
            type="button"
          >
            <Menu aria-hidden="true" className="size-5" />
          </button>
          <div>
            <p className="text-xs font-medium text-muted-foreground">UniBridge</p>
            <h1 className="text-sm font-semibold text-foreground">{title}</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {tools}
          <button
            className="hidden min-h-10 rounded-xl border border-border px-3 text-sm font-medium hover:bg-muted sm:inline-flex sm:items-center"
            onClick={() => signOut({ callbackUrl: "/" })}
            type="button"
          >
            Đăng xuất
          </button>
        </div>
      </header>
      {mobileOpen ? (
        <button
          aria-label="Đóng menu điều hướng"
          className="fixed inset-0 z-40 bg-slate-950/30 lg:hidden"
          onClick={() => setMobileOpen(false)}
          type="button"
        />
      ) : null}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-[transform,width] duration-200 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "lg:w-20" : ""}`}
      >
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
          <Link className="truncate text-lg font-bold tracking-tight text-white" href="/">
            {collapsed ? "UB" : "UniBridge"}
          </Link>
          <button
            aria-label="Đóng menu điều hướng"
            className="inline-flex size-10 items-center justify-center rounded-xl text-sidebar-foreground hover:bg-sidebar-accent lg:hidden"
            onClick={() => setMobileOpen(false)}
            type="button"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        <nav aria-label={`Điều hướng ${title}`} className="flex-1 space-y-1 overflow-y-auto p-3">
          {links.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                className={`flex min-h-11 items-center rounded-xl px-3 text-sm font-medium transition-colors ${
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                } ${collapsed ? "justify-center" : ""}`}
                href={link.href}
                key={link.href}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? link.label : undefined}
              >
                <span className={collapsed ? "sr-only" : undefined}>{link.label}</span>
                {collapsed ? <span aria-hidden="true">{link.label.slice(0, 1)}</span> : null}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <button
            aria-label={collapsed ? "Mở rộng menu" : "Thu gọn menu"}
            className="hidden min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground lg:flex"
            onClick={toggleCollapsed}
            type="button"
          >
            {collapsed ? <ChevronRight aria-hidden="true" /> : <ChevronLeft aria-hidden="true" />}
            <span className={collapsed ? "sr-only" : undefined}>
              {collapsed ? "Mở rộng" : "Thu gọn"}
            </span>
          </button>
          <button
            className="mt-2 flex min-h-11 w-full items-center justify-center rounded-xl border border-sidebar-border px-3 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent sm:hidden"
            onClick={() => signOut({ callbackUrl: "/" })}
            type="button"
          >
            Đăng xuất
          </button>
        </div>
      </aside>
      <div className="hidden lg:block lg:w-64" aria-hidden="true" />
    </>
  );
}
