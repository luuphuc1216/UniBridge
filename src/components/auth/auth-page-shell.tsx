import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { UniBridgeLogo } from "@/components/brand/unibridge-logo";

type AuthPageShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  wide?: boolean;
};

export function AuthPageShell({
  eyebrow,
  title,
  description,
  children,
  wide = false,
}: AuthPageShellProps) {
  return (
    <main className="relative isolate min-h-dvh overflow-hidden bg-background">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-gradient-to-b from-accent/70 to-transparent"
      />
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <UniBridgeLogo />
        <Link
          className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          href="/"
        >
          ← Trang chủ
        </Link>
      </header>

      <div className="mx-auto grid w-full max-w-7xl items-center gap-8 px-4 pb-10 pt-3 sm:px-6 sm:pb-14 lg:px-8 xl:min-h-[calc(100dvh-5rem)] xl:grid-cols-[0.9fr_1.1fr] xl:gap-12 xl:py-10">
        <aside className="relative hidden min-h-[34rem] flex-col justify-between overflow-hidden rounded-[2rem] bg-brand-navy p-10 text-white xl:flex 2xl:p-12">
          <div
            aria-hidden="true"
            className="absolute -right-24 -top-24 size-80 rounded-full border border-white/10"
          />
          <div
            aria-hidden="true"
            className="absolute -bottom-36 -left-20 size-96 rounded-full border border-white/10"
          />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/75">
              Connect Ideas. Create Impact.
            </p>
            <h2 className="mt-8 max-w-md text-4xl font-semibold leading-tight tracking-tight 2xl:text-5xl">
              Kết nối tri thức.
              <br />
              Tạo giá trị thực tế.
            </h2>
            <p className="mt-5 max-w-sm text-base leading-7 text-white/75">
              Nơi doanh nghiệp chia sẻ bài toán và nhóm sinh viên cùng phát triển giải pháp.
            </p>
          </div>
          <div className="relative grid gap-3">
            {[
              "Bài toán thực tế từ doanh nghiệp",
              "Ý tưởng và năng lực từ sinh viên",
              "Cùng kết nối để tạo nên giải pháp",
            ].map((text, index) => (
              <div
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5"
                key={text}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-semibold text-white/80">
                  0{index + 1}
                </span>
                <span className="text-sm font-medium text-white/90">{text}</span>
                {index === 2 ? (
                  <ArrowUpRight aria-hidden="true" className="ml-auto size-4 text-white/75" />
                ) : null}
              </div>
            ))}
          </div>
          <p className="relative text-xs text-white/60">
            Kết nối năng lực với những vấn đề cần lời giải.
          </p>
        </aside>

        <section className={`mx-auto w-full ${wide ? "max-w-2xl" : "max-w-lg"}`}>
          <Card className="rounded-3xl border-border/80 shadow-lg shadow-brand-navy/5">
            <CardHeader className="space-y-3 p-6 pb-0 sm:p-9 sm:pb-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                {eyebrow}
              </p>
              <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                {title}
              </h1>
              <CardDescription className="max-w-xl text-sm leading-6 sm:text-base">
                {description}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-6 sm:p-9 sm:pt-7">{children}</CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
