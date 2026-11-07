import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { RequestPasswordResetForm } from "@/components/auth/password-reset-forms";

export default function ForgotPasswordPage() {
  return (
    <AuthPageShell
      description="Nhập email tài khoản. Nếu email tồn tại, chúng tôi sẽ gửi hướng dẫn đặt lại mật khẩu."
      eyebrow="Khôi phục quyền truy cập"
      title="Quên mật khẩu"
    >
      <RequestPasswordResetForm />
    </AuthPageShell>
  );
}
