"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const navigationItems = [
  { href: "#bai-toan", label: "Khám phá bài toán" },
  { href: "#gioi-thieu", label: "Về UniBridge" },
  { href: "#doanh-nghiep", label: "Doanh nghiệp" },
  { href: "#sinh-vien", label: "Sinh viên" },
  { href: "#quy-trinh", label: "Quy trình" },
  { href: "/ve-chung-toi", label: "Về chúng tôi" },
  { href: "#cau-hoi", label: "Câu hỏi thường gặp" },
];

const linkClassName =
  "rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

export function LandingNavigation({
  homePagePrefix = false,
}: {
  homePagePrefix?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  function closeMenu() {
    setIsOpen(false);
  }

  function getHref(href: string) {
    return homePagePrefix && href.startsWith("#") ? `/${href}` : href;
  }

  return (
    <>
      <nav aria-label="Điều hướng chính" className="hidden items-center gap-1 lg:flex">
        {navigationItems.map((item) => (
          <Link className={linkClassName} href={getHref(item.href)} key={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="relative lg:hidden">
        <Button
          aria-controls="landing-mobile-navigation"
          aria-expanded={isOpen}
          aria-label={isOpen ? "Đóng menu điều hướng" : "Mở menu điều hướng"}
          onClick={() => setIsOpen((open) => !open)}
          size="icon"
          variant="outline"
        >
          {isOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </Button>
        <nav
          aria-label="Điều hướng di động"
          className={`absolute right-0 top-full z-40 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-3 shadow-lg ${
            isOpen ? "block" : "hidden"
          }`}
          id="landing-mobile-navigation"
        >
          <div className="grid gap-1">
            {navigationItems.map((item) => (
              <Link
                className={linkClassName}
                href={getHref(item.href)}
                key={item.href}
                onClick={closeMenu}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 border-t border-border pt-3">
            <Link
              className="rounded-xl px-3 py-2.5 text-center text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              href="/dang-nhap"
              onClick={closeMenu}
            >
              Đăng nhập
            </Link>
            <Link
              className="rounded-xl bg-primary px-3 py-2.5 text-center text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              href="/dang-ky"
              onClick={closeMenu}
            >
              Đăng ký
            </Link>
          </div>
        </nav>
      </div>
    </>
  );
}
