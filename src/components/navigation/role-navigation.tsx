"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useRef, useState, type ReactNode } from "react";
import {
  ArrowLeftRight,
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileCheck2,
  Flag,
  Home,
  Menu,
  MessageSquareText,
  ScrollText,
  Search,
  Bookmark,
  FileText,
  Wallet,
  LayoutDashboard,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { UniBridgeLogo } from "@/components/brand/unibridge-logo";

export type NavigationLink = {
  href: string;
  label: string;
};

type RoleNavigationProps = {
  title: string;
  links: NavigationLink[];
  tools?: ReactNode;
  variant?: "default" | "business" | "admin";
};

const adminNavigationGroups: { label: string; hrefs: string[] }[] = [
  { label: "Không gian làm việc", hrefs: ["/admin"] },
  {
    label: "Quản lý",
    hrefs: ["/admin/accounts", "/admin/problems", "/admin/reports"],
  },
  {
    label: "Theo dõi",
    hrefs: ["/admin/prototype-handoffs", "/admin/audit-logs"],
  },
] as const;

const adminNavigationIcons: Record<string, LucideIcon> = {
  "/admin": Home,
  "/admin/accounts": UsersRound,
  "/admin/problems": ClipboardCheck,
  "/admin/reports": Flag,
  "/admin/prototype-handoffs": FileCheck2,
  "/admin/audit-logs": ScrollText,
};

const businessNavigationIcons: Record<string, LucideIcon> = {
  "/business": Home,
  "/business/problems": ClipboardList,
  "/business/credits": CreditCard,
  "/business/projects": BriefcaseBusiness,
  "/business/transactions": ArrowLeftRight,
  "/business/messages": MessageSquareText,
};

const studentNavigationIcons: Record<string, LucideIcon> = {
  "/student": LayoutDashboard,
  "/student/problems": Search,
  "/student/saved-problems": Bookmark,
  "/student/team": UsersRound,
  "/student/applications": FileText,
  "/student/projects": BriefcaseBusiness,
  "/student/transactions": Wallet,
  "/student/messages": MessageSquareText,
};

export function RoleNavigation({
  title,
  links,
  tools,
  variant = "default",
}: RoleNavigationProps) {
  const pathname = usePathname();
  const [isAdminMobileMenuOpen, setIsAdminMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isStudentMobileMenuOpen, setIsStudentMobileMenuOpen] = useState(false);
  const adminMenuButtonRef = useRef<HTMLButtonElement>(null);
  const studentMenuButtonRef = useRef<HTMLButtonElement>(null);

  if (variant === "admin") {
    const isActiveLink = (href: string) =>
      pathname === href || (href !== "/admin" && pathname.startsWith(`${href}/`));
    const activeLink = links.find((link) => isActiveLink(link.href));

    return (
      <>
        <aside
          className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-sidebar-border bg-sidebar py-6 transition-[width,padding] motion-reduce:transition-none lg:flex ${
            isSidebarCollapsed ? "w-20 px-2" : "w-64 px-4"
          }`}
          data-sidebar-collapsed={isSidebarCollapsed ? "true" : undefined}
        >
          <div
            className={`flex items-center gap-2 ${
              isSidebarCollapsed
                ? "flex-col justify-center"
                : "flex-row justify-between"
            }`}
          >
            <UniBridgeLogo
              collapsed={isSidebarCollapsed}
              className={isSidebarCollapsed ? "w-full" : "px-3"}
            />
            <button
              aria-label={isSidebarCollapsed ? "Mở rộng thanh điều hướng" : "Thu gọn thanh điều hướng"}
              className="hidden size-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none lg:inline-flex"
              onClick={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
              title={isSidebarCollapsed ? "Mở rộng thanh điều hướng" : "Thu gọn thanh điều hướng"}
              type="button"
            >
              {isSidebarCollapsed ? (
                <ChevronRight aria-hidden="true" className="size-4" />
              ) : (
                <ChevronLeft aria-hidden="true" className="size-4" />
              )}
            </button>
          </div>
          <div className={`mt-8 rounded-2xl border border-sidebar-border bg-card px-4 py-4 ${isSidebarCollapsed ? "hidden" : ""}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Không gian làm việc
            </p>
            <p className="mt-1 font-semibold text-foreground">{title}</p>
          </div>
          <nav aria-label={`Điều hướng ${title}`} className={`mt-8 grid ${isSidebarCollapsed ? "gap-3" : "gap-6"}`}>
            {adminNavigationGroups.map((group) => {
              const groupLinks = links.filter((link) => group.hrefs.includes(link.href));
              if (!groupLinks.length) return null;

              return (
                <div key={group.label}>
                  <p className={`mb-2 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground ${isSidebarCollapsed ? "sr-only" : ""}`}>
                    {group.label}
                  </p>
                  <ul className="grid gap-1">
                    {groupLinks.map((link) => {
                      const isActive = isActiveLink(link.href);
                      const Icon = adminNavigationIcons[link.href];
                      return (
                        <li key={link.href}>
                          <Link
                            aria-current={isActive ? "page" : undefined}
                            className={`relative flex min-h-11 items-center rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none ${
                              isActive
                                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            } ${isSidebarCollapsed ? "justify-center px-0" : "gap-3 px-3"}`}
                            href={link.href}
                            title={isSidebarCollapsed ? link.label : undefined}
                          >
                            {Icon ? (
                              <span className="relative grid size-6 shrink-0 place-items-center">
                                <Icon aria-hidden="true" className="size-4" />
                                {isSidebarCollapsed && link.label.match(/\((\d+)\)$/)?.[1] && (
                                  <span aria-hidden="true" className="absolute -right-2 -top-1 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] leading-4 text-primary-foreground">
                                    {link.label.match(/\((\d+)\)$/)?.[1]}
                                  </span>
                                )}
                              </span>
                            ) : null}
                            <span className={isSidebarCollapsed ? "sr-only" : "min-w-0 break-words"}>
                              {link.label}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </nav>
          <div className={`mt-auto border-t border-sidebar-border px-3 pt-5 ${isSidebarCollapsed ? "sr-only" : ""}`}>
            <p className="text-xs leading-5 text-muted-foreground">
              Quyền truy cập được giới hạn theo vai trò quản trị viên.
            </p>
          </div>
        </aside>

        <div>
          <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur lg:ml-64 group-has-[[data-sidebar-collapsed=true]]:lg:ml-20">
            <div className="mx-auto flex min-h-16 max-w-[1600px] items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
              <div className="min-w-0">
                <UniBridgeLogo className="shrink-0 lg:hidden" size="compact" />
                <p className="hidden text-sm font-semibold text-foreground lg:block">
                  {activeLink?.label ?? title}
                </p>
                <p className="text-xs text-muted-foreground lg:hidden">
                  {activeLink?.label ?? title}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                <button
                  aria-controls="admin-mobile-navigation"
                  aria-expanded={isAdminMobileMenuOpen}
                  aria-label={isAdminMobileMenuOpen ? "Đóng menu điều hướng" : "Mở menu điều hướng"}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none lg:hidden"
                  onClick={() => setIsAdminMobileMenuOpen((open) => !open)}
                  ref={adminMenuButtonRef}
                  type="button"
                >
                  {isAdminMobileMenuOpen ? (
                    <X aria-hidden="true" className="size-4" />
                  ) : (
                    <Menu aria-hidden="true" className="size-4" />
                  )}
                  <span className="sr-only sm:not-sr-only">
                    {isAdminMobileMenuOpen ? "Đóng menu" : "Menu"}
                  </span>
                </button>
                {tools}
                <button
                  className="inline-flex min-h-11 items-center rounded-xl border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none sm:px-4"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  type="button"
                >
                  Đăng xuất
                </button>
              </div>
            </div>
          </header>
          <nav
            aria-label={`Điều hướng ${title}`}
            className={`border-b border-border bg-card lg:hidden ${
              isAdminMobileMenuOpen ? "block" : "hidden"
            }`}
            id="admin-mobile-navigation"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setIsAdminMobileMenuOpen(false);
                adminMenuButtonRef.current?.focus();
              }
            }}
          >
            <ul className="mx-auto grid max-w-[1600px] gap-1 px-3 py-2 sm:px-6">
              {links.map((link) => {
                const isActive = isActiveLink(link.href);
                const Icon = adminNavigationIcons[link.href];
                return (
                  <li key={link.href}>
                    <Link
                      aria-current={isActive ? "page" : undefined}
                      className={`flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none ${
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                      href={link.href}
                      onClick={() => setIsAdminMobileMenuOpen(false)}
                    >
                      {Icon ? <Icon aria-hidden="true" className="size-4 shrink-0" /> : null}
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </>
    );
  }

  if (variant === "business") {
    const isActiveLink = (href: string) =>
      pathname === href || (href !== "/business" && pathname.startsWith(`${href}/`));

    return (
      <>
        <aside
          className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border bg-card py-6 transition-[width,padding] motion-reduce:transition-none lg:flex ${
            isSidebarCollapsed ? "w-20 px-2" : "w-64 px-4"
          }`}
          data-sidebar-collapsed={isSidebarCollapsed ? "true" : undefined}
        >
          <div
            className={`flex items-center gap-2 ${
              isSidebarCollapsed
                ? "flex-col justify-center"
                : "flex-row justify-between"
            }`}
          >
            <UniBridgeLogo
              collapsed={isSidebarCollapsed}
              className={isSidebarCollapsed ? "w-full" : "px-3"}
            />
            <button
              aria-label={isSidebarCollapsed ? "Mở rộng thanh điều hướng" : "Thu gọn thanh điều hướng"}
              className="hidden size-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none lg:inline-flex"
              onClick={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
              title={isSidebarCollapsed ? "Mở rộng thanh điều hướng" : "Thu gọn thanh điều hướng"}
              type="button"
            >
              {isSidebarCollapsed ? (
                <ChevronRight aria-hidden="true" className="size-4" />
              ) : (
                <ChevronLeft aria-hidden="true" className="size-4" />
              )}
            </button>
          </div>
          <div className={`mt-8 rounded-2xl bg-primary/5 px-4 py-4 ${isSidebarCollapsed ? "hidden" : ""}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Không gian làm việc
            </p>
            <p className="mt-1 font-semibold text-foreground">{title}</p>
          </div>
          <nav aria-label={`Điều hướng ${title}`} className={`mt-6 grid gap-1 ${isSidebarCollapsed ? "gap-2" : ""}`}>
            {links.map((link) => {
              const isActive = isActiveLink(link.href);
              const Icon = businessNavigationIcons[link.href];
              return (
                <Link
                  aria-current={isActive ? "page" : undefined}
                  className={`relative flex min-h-11 items-center rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  } ${isSidebarCollapsed ? "justify-center px-0" : "gap-3 px-3"}`}
                  href={link.href}
                  key={link.href}
                  title={isSidebarCollapsed ? link.label : undefined}
                >
                  {Icon ? (
                    <span className="relative grid size-6 shrink-0 place-items-center">
                      <Icon aria-hidden="true" className="size-4" />
                      {isSidebarCollapsed && link.label.match(/\((\d+)\)$/)?.[1] && (
                        <span aria-hidden="true" className="absolute -right-2 -top-1 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] leading-4 text-primary-foreground">
                          {link.label.match(/\((\d+)\)$/)?.[1]}
                        </span>
                      )}
                    </span>
                  ) : null}
                  <span className={isSidebarCollapsed ? "sr-only" : "min-w-0 break-words"}>
                    {link.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur lg:ml-64 group-has-[[data-sidebar-collapsed=true]]:lg:ml-20">
          <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
            <div className="min-w-0">
              <UniBridgeLogo className="shrink-0 lg:hidden" size="compact" />
              <p className="hidden text-sm font-semibold text-foreground lg:block">
                Khu vực {title.toLocaleLowerCase("vi")}
              </p>
              <p className="text-xs text-muted-foreground lg:hidden">{title}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              {tools}
              <button
                className="inline-flex min-h-11 items-center rounded-xl border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none sm:px-4"
                onClick={() => signOut({ callbackUrl: "/" })}
                type="button"
              >
                Đăng xuất
              </button>
            </div>
          </div>
        </header>

        <nav
          aria-label={`Điều hướng ${title}`}
          className="border-b border-border bg-card lg:hidden"
        >
          <div className="flex gap-1 overflow-x-auto px-3 py-2 sm:px-6">
            {links.map((link) => {
              const isActive = isActiveLink(link.href);
              return (
                <Link
                  aria-current={isActive ? "page" : undefined}
                  className={`inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                  href={link.href}
                  key={link.href}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </>
    );
  }

  if (variant === "default") {
    const isActiveLink = (href: string) =>
      pathname === href ||
      (href !== "/student" && pathname.startsWith(`${href}/`)) ||
      (href === "/student/messages" && pathname.startsWith("/student/workspace/"));
    const activeLink = links.find((link) => isActiveLink(link.href));

    return (
      <>
        <aside
          className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border bg-card py-6 transition-[width,padding] motion-reduce:transition-none lg:flex ${
            isSidebarCollapsed ? "w-20 px-2" : "w-64 px-4"
          }`}
          data-sidebar-collapsed={isSidebarCollapsed ? "true" : undefined}
        >
          <div
            className={`flex items-center gap-2 ${
              isSidebarCollapsed
                ? "flex-col justify-center"
                : "flex-row justify-between"
            }`}
          >
            <UniBridgeLogo
              collapsed={isSidebarCollapsed}
              className={isSidebarCollapsed ? "w-full" : "px-3"}
            />
            <button
              aria-label={isSidebarCollapsed ? "Mở rộng thanh điều hướng" : "Thu gọn thanh điều hướng"}
              className="hidden size-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none lg:inline-flex"
              onClick={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
              title={isSidebarCollapsed ? "Mở rộng thanh điều hướng" : "Thu gọn thanh điều hướng"}
              type="button"
            >
              {isSidebarCollapsed ? (
                <ChevronRight aria-hidden="true" className="size-4" />
              ) : (
                <ChevronLeft aria-hidden="true" className="size-4" />
              )}
            </button>
          </div>
          <div className={`mt-8 rounded-2xl bg-primary/5 px-4 py-4 ${isSidebarCollapsed ? "hidden" : ""}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Không gian làm việc
            </p>
            <p className="mt-1 font-semibold text-foreground">Sinh viên</p>
          </div>
          <nav aria-label="Điều hướng sinh viên" className={`mt-6 grid ${isSidebarCollapsed ? "gap-2" : "gap-1"}`}>
            {links.map((link) => {
              const isActive = isActiveLink(link.href);
              const Icon = studentNavigationIcons[link.href];
              const unreadCount = link.href === "/student/messages"
                ? Number(link.label.match(/\((\d+)\)$/)?.[1] ?? 0)
                : 0;
              return (
                <Link
                  aria-current={isActive ? "page" : undefined}
                  className={`relative flex min-h-11 items-center rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  } ${isSidebarCollapsed ? "justify-center px-0" : "gap-3 px-3"}`}
                  href={link.href}
                  key={link.href}
                  title={isSidebarCollapsed ? link.label : undefined}
                >
                  {Icon && (
                    <span className="relative grid size-6 shrink-0 place-items-center">
                      <Icon aria-hidden="true" className="size-4" />
                      {isSidebarCollapsed && unreadCount > 0 && (
                        <span aria-label={`${unreadCount} tin nhắn chưa đọc`} className="absolute -right-2 -top-1 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] leading-4 text-primary-foreground">
                          {unreadCount}
                        </span>
                      )}
                    </span>
                  )}
                  <span className={isSidebarCollapsed ? "sr-only" : "min-w-0 break-words"}>
                    {link.href === "/student/messages" ? "Tin nhắn" : link.label}
                  </span>
                  {!isSidebarCollapsed && unreadCount > 0 && (
                    <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                      {unreadCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
          <div className={`mt-auto border-t border-border px-3 pt-5 ${isSidebarCollapsed ? "sr-only" : ""}`}>
            <p className="text-xs leading-5 text-muted-foreground">
              Kết nối nhóm sinh viên với bài toán thực tế từ doanh nghiệp.
            </p>
          </div>
        </aside>

        <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur lg:ml-64 group-has-[[data-sidebar-collapsed=true]]:lg:ml-20">
          <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
            <div className="min-w-0">
              <UniBridgeLogo className="shrink-0 lg:hidden" size="compact" />
              <p className="hidden text-sm font-semibold text-foreground lg:block">
                {activeLink?.label ?? title}
              </p>
              <p className="text-xs text-muted-foreground lg:hidden">
                {activeLink?.label ?? title}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <button
                aria-controls="student-mobile-navigation"
                aria-expanded={isStudentMobileMenuOpen}
                aria-label={isStudentMobileMenuOpen ? "Đóng menu điều hướng" : "Mở menu điều hướng"}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none lg:hidden"
                onClick={() => setIsStudentMobileMenuOpen((open) => !open)}
                ref={studentMenuButtonRef}
                type="button"
              >
                {isStudentMobileMenuOpen ? (
                  <X aria-hidden="true" className="size-4" />
                ) : (
                  <Menu aria-hidden="true" className="size-4" />
                )}
                <span>{isStudentMobileMenuOpen ? "Đóng menu" : "Menu"}</span>
              </button>
              {tools}
              <button
                className="inline-flex min-h-11 items-center rounded-xl border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none sm:px-4"
                onClick={() => signOut({ callbackUrl: "/" })}
                type="button"
              >
                Đăng xuất
              </button>
            </div>
          </div>
        </header>

        <nav
          aria-label="Điều hướng sinh viên"
          className={`border-b border-border bg-card lg:hidden ${isStudentMobileMenuOpen ? "block" : "hidden"}`}
          id="student-mobile-navigation"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setIsStudentMobileMenuOpen(false);
              studentMenuButtonRef.current?.focus();
            }
          }}
        >
          <ul className="mx-auto grid max-w-7xl gap-1 px-3 py-2 sm:grid-cols-2 sm:px-6">
            {links.map((link) => {
              const isActive = isActiveLink(link.href);
              const Icon = studentNavigationIcons[link.href];
              return (
                <li key={link.href}>
                  <Link
                    aria-current={isActive ? "page" : undefined}
                    className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none ${
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                    href={link.href}
                    onClick={() => setIsStudentMobileMenuOpen(false)}
                  >
                    {Icon && <Icon aria-hidden="true" className="size-4 shrink-0" />}
                    {link.href === "/student/messages" ? "Tin nhắn" : link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </>
    );
  }

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
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary lg:inline-flex">
              {title}
            </span>
            {tools}
          </div>
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
