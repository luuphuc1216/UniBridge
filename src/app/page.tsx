import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { auth } from "@/auth";
import { getRoleHome } from "@/lib/roles";

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-background">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <Link className="text-xl font-bold tracking-tight text-primary" href="/">
          UniBridge
        </Link>
        <Suspense
          fallback={
            <Link
              className="text-sm font-semibold text-muted-foreground"
              href="/dang-nhap"
            >
              Đăng nhập
            </Link>
          }
        >
          <HomeActions />
        </Suspense>
      </header>
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
        <div>
          <p className="inline-flex rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
            Kết nối tri thức với thực tiễn
          </p>
          <h1 className="mt-6 max-w-2xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            Bài toán doanh nghiệp.{" "}
            <span className="text-primary">Giải pháp từ sinh viên.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
            UniBridge kết nối doanh nghiệp cần lời giải với những nhóm sinh viên
            sẵn sàng biến kiến thức thành dự án thực tế.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              className="rounded-xl bg-primary px-6 py-3 text-center font-semibold text-primary-foreground transition hover:opacity-90"
              href="/dang-ky"
            >
              Tham gia UniBridge
            </Link>
            <Link
              className="rounded-xl border border-border px-6 py-3 text-center font-semibold transition hover:bg-muted"
              href="/dang-nhap"
            >
              Đăng nhập
            </Link>
          </div>
        </div>
        <div className="rounded-3xl bg-primary p-6 text-primary-foreground shadow-xl sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary-foreground/70">
            Cùng tạo giá trị
          </p>
          <div className="mt-8 space-y-4">
            {[
              ["01", "Doanh nghiệp chia sẻ vấn đề thực tế"],
              ["02", "Sinh viên đề xuất hướng giải quyết"],
              ["03", "Hai bên cùng phát triển giải pháp"],
            ].map(([number, text]) => (
              <div
                className="flex items-center gap-4 rounded-2xl border border-white/15 bg-white/10 p-4"
                key={number}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/15 text-sm font-bold">
                  {number}
                </span>
                <p className="font-medium leading-6">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

async function HomeActions() {
  await connection();
  const session = await auth();

  if (session?.user) {
    return (
      <Link
        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        href={getRoleHome(session.user.role)}
      >
        Vào dashboard
      </Link>
    );
  }

  return (
    <Link
      className="text-sm font-semibold text-muted-foreground transition hover:text-foreground"
      href="/dang-nhap"
    >
      Đăng nhập
    </Link>
  );
}
