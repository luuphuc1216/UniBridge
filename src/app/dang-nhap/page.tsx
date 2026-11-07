import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { LoginForm } from "@/components/auth/login-form";
import { getRoleHome } from "@/lib/roles";

type LoginPageProps = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

export default function LoginPage({ searchParams }: LoginPageProps) {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center text-sm text-muted-foreground">
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
    <AuthPageShell
      description="Tiếp tục kết nối doanh nghiệp với những ý tưởng sinh viên."
      eyebrow="Chào mừng trở lại"
      title="Đăng nhập"
    >
      <LoginForm callbackUrl={params.callbackUrl} />
      <p className="mt-5 text-center text-sm">
        <Link
          className="rounded-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          href="/quen-mat-khau"
        >
          Quên mật khẩu?
        </Link>
      </p>
      <p className="mt-5 text-center text-sm text-muted-foreground">
        Chưa có tài khoản?{" "}
        <Link
          className="rounded-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          href="/dang-ky"
        >
          Đăng ký miễn phí
        </Link>
      </p>
    </AuthPageShell>
  );
}
