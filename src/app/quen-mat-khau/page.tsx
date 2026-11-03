import Link from "next/link";
import { RequestPasswordResetForm } from "@/components/auth/password-reset-forms";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-9">
        <Link className="text-sm font-semibold text-primary" href="/">
          ← UniBridge
        </Link>
        <h1 className="mt-8 text-3xl font-bold tracking-tight">Quên mật khẩu</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Nhập email tài khoản. Nếu email tồn tại, chúng tôi sẽ gửi hướng dẫn đặt lại mật khẩu.
        </p>
        <RequestPasswordResetForm />
      </section>
    </main>
  );
}
