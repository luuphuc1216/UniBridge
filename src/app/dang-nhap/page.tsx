import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "@/components/auth/login-form";
import { getRoleHome } from "@/lib/roles";

type LoginPageProps = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

export default function LoginPage({ searchParams }: LoginPageProps) {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
          Đang tải...
        </main>
      }
    >
      <LoginContent searchParams={searchParams} />
    </Suspense>
  );
}

async function LoginContent({ searchParams }: LoginPageProps) {
  const [session, params] = await Promise.all([auth(), searchParams]);
  if (session?.user) {
    redirect(getRoleHome(session.user.role));
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <section className="w-full max-w-md rounded-[2rem] border border-border bg-card p-6 shadow-sm sm:p-9">
        <Link className="text-sm font-semibold text-brand-navy" href="/">
          ← UNIBRIDGE
        </Link>
        <p className="mt-8 text-sm font-semibold uppercase tracking-[0.18em] text-primary">
          Chào mừng trở lại
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Đăng nhập</h1>
        <p className="mt-2 mb-7 text-sm leading-6 text-muted-foreground">
          Tiếp tục kết nối doanh nghiệp với những ý tưởng sinh viên.
        </p>
        <LoginForm callbackUrl={params.callbackUrl} />
        <p className="mt-4 text-center text-sm">
          <Link className="font-semibold text-primary hover:underline" href="/quen-mat-khau">
            Quên mật khẩu?
          </Link>
        </p>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Chưa có tài khoản?{" "}
          <Link className="font-semibold text-primary hover:underline" href="/dang-ky">
            Đăng ký miễn phí
          </Link>
        </p>
      </section>
    </main>
  );
}
