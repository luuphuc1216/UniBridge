"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  BarChart3,
  Bookmark,
  BriefcaseBusiness,
  Building2,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileCheck2,
  FilePlus2,
  Files,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";

export type NavigationLink = {
  href: string;
  label: string;
};

type RoleNavigationProps = {
  title: string;
  links: NavigationLink[];
  tools?: ReactNode;
};

function BrandMark({ collapsed }: { collapsed: boolean }) {
  return (
    <Link
      aria-label="UniBridge"
      className={`flex min-w-0 items-center gap-3 text-white ${
        collapsed ? "justify-center" : ""
      }`}
      href="/"
      title="UniBridge"
    >
      <svg
        aria-hidden="true"
        className="size-10 shrink-0"
        fill="none"
        viewBox="0 0 40 40"
      >
        <rect fill="var(--primary)" height="40" rx="12" width="40" />
        <text
          fill="white"
          fontFamily="Arial, sans-serif"
          fontSize="13"
          fontWeight="700"
          textAnchor="middle"
          x="20"
          y="25"
        >
          UB
        </text>
      </svg>
      <span
        className={`overflow-hidden whitespace-nowrap text-lg font-bold tracking-tight transition-[opacity,max-width] duration-200 ${
          collapsed ? "max-w-0 opacity-0" : "max-w-32 opacity-100"
        }`}
      >
        UniBridge
      </span>
    </Link>
  );
}

const navigationIcons: Record<string, LucideIcon> = {
  "Tổng quan": LayoutDashboard,
  "Khám phá bài toán": Search,
  "Bài toán đã lưu": Bookmark,
  "Hồ sơ nhóm": Users,
  "Hồ sơ đã gửi": FileCheck2,
  "Dự án": FolderKanban,
  "Giao dịch": WalletCards,
  "Hồ sơ doanh nghiệp": Building2,
  "Đăng bài toán": FilePlus2,
  "Quản lý bài toán": Files,
  "Bài toán của tôi": Files,
  "Gói và hạn mức": WalletCards,
  "Tài khoản": UserCog,
  "Duyệt bài toán": ClipboardCheck,
  "Báo cáo vi phạm": ShieldCheck,
  "Kiểm tra bàn giao Bản thử nghiệm (Prototype)": CheckSquare,
  "Quản lý dự án": BriefcaseBusiness,
  "Báo cáo và xử lý phát sinh": ListChecks,
  "Thống kê": BarChart3,
  "Cài đặt": Settings,
};

export function RoleNavigation({ title, links, tools }: RoleNavigationProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const storedCollapsed =
      window.localStorage.getItem("unibridge-sidebar-collapsed") === "true";
    document.body.dataset.sidebarCollapsed = String(storedCollapsed);
    if (storedCollapsed) {
      const frame = window.requestAnimationFrame(() => setCollapsed(true));
      return () => window.cancelAnimationFrame(frame);
    }
    return undefined;
  }, []);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("unibridge-sidebar-collapsed", String(next));
      document.body.dataset.sidebarCollapsed = String(next);
      return next;
    });
  }

  const activeHref = links
    .filter((link) => {
      const isRoleRoot = /^\/(student|business|admin)$/.test(link.href);
      return isRoleRoot
        ? pathname === link.href
        : pathname === link.href || pathname.startsWith(`${link.href}/`);
    })
    .sort((left, right) => right.href.length - left.href.length)[0]?.href;

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur sm:px-6 lg:px-8">
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
        className={`fixed inset-y-0 left-0 z-50 flex w-[var(--sidebar-w)] flex-col bg-sidebar text-sidebar-foreground transition-[transform,width] duration-200 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
          <BrandMark collapsed={collapsed} />
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
            const active = link.href === activeHref;
            const Icon = navigationIcons[link.label] ?? ListChecks;
            return (
              <Link
                aria-current={active ? "page" : undefined}
                aria-label={collapsed ? link.label : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring ${
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                } ${collapsed ? "justify-center" : ""}`}
                href={link.href}
                key={link.href}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? link.label : undefined}
              >
                <Icon aria-hidden="true" className="size-5 shrink-0" />
                <span className={collapsed ? "sr-only" : undefined}>{link.label}</span>
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
    </>
  );
}
