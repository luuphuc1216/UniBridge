import Link from "next/link";
import { CompletePasswordResetForm } from "@/components/auth/password-reset-forms";

export const instant = false;

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <section className="w-full max-w-md rounded-[2rem] border border-border bg-card p-6 shadow-sm sm:p-9">
        <Link className="text-sm font-semibold text-brand-navy" href="/">
          ← UNIBRIDGE
        </Link>
        <h1 className="mt-8 text-3xl font-bold tracking-tight">Đặt lại mật khẩu</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Chọn mật khẩu mới có ít nhất 8 ký tự.
        </p>
        <CompletePasswordResetForm token={token ?? ""} />
      </section>
    </main>
  );
}
