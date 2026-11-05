import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { RegistrationForm } from "@/components/auth/registration-form";
import { getRoleHome } from "@/lib/roles";

export default function RegistrationPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
          Đang tải...
        </main>
      }
    >
      <RegistrationContent />
    </Suspense>
  );
}

async function RegistrationContent() {
  const session = await auth();
  if (session?.user) {
    redirect(getRoleHome(session.user.role));
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <section className="w-full max-w-2xl rounded-[2rem] border border-border bg-card p-6 shadow-sm sm:p-9">
        <Link className="text-sm font-semibold text-brand-navy" href="/">
          ← UNIBRIDGE
        </Link>
        <p className="mt-8 text-sm font-semibold uppercase tracking-[0.18em] text-primary">
          Bắt đầu cùng UniBridge
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Tạo tài khoản</h1>
        <p className="mt-2 mb-7 text-sm leading-6 text-muted-foreground">
          Chọn vai trò để kết nối đúng với cộng đồng phù hợp.
        </p>
        <RegistrationForm />
      </section>
    </main>
  );
}
