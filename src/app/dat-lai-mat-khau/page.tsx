import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { CompletePasswordResetForm } from "@/components/auth/password-reset-forms";

export const instant = false;

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <AuthPageShell
      description="Chọn mật khẩu mới có ít nhất 8 ký tự."
      eyebrow="Bảo mật tài khoản"
      title="Đặt lại mật khẩu"
    >
      <CompletePasswordResetForm token={token ?? ""} />
    </AuthPageShell>
  );
}
