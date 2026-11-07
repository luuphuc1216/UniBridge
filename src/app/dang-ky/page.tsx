import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { RegistrationForm } from "@/components/auth/registration-form";
import { getRoleHome } from "@/lib/roles";

export default function RegistrationPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center text-sm text-muted-foreground">
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
    <AuthPageShell
      description="Chọn vai trò để kết nối đúng với cộng đồng phù hợp."
      eyebrow="Bắt đầu cùng UniBridge"
      title="Tạo tài khoản"
      wide
    >
      <RegistrationForm />
    </AuthPageShell>
  );
}
