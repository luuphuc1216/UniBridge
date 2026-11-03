export type PasswordResetEmail = {
  email: string;
  name: string;
  token: string;
  resetUrl: string;
};

export interface EmailSender {
  sendPasswordReset(email: PasswordResetEmail): Promise<void>;
}

export class ConsoleEmailSender implements EmailSender {
  async sendPasswordReset(email: PasswordResetEmail): Promise<void> {
    const token =
      process.env.NODE_ENV === "production" ? "[redacted]" : email.token;
    console.info("UniBridge password reset email", {
      to: email.email,
      name: email.name,
      resetUrl:
        process.env.NODE_ENV === "production"
          ? "[redacted]"
          : email.resetUrl.replace(email.token, token),
      token,
    });
  }
}

export class ResendEmailSender implements EmailSender {
  async sendPasswordReset(email: PasswordResetEmail): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!apiKey || !from) {
      throw new Error("Resend email configuration is incomplete.");
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email.email],
        subject: "Đặt lại mật khẩu UniBridge",
        text: `Xin chào ${email.name},\n\nTruy cập liên kết sau để đặt lại mật khẩu trong 30 phút:\n${email.resetUrl}\n\nNếu bạn không yêu cầu, hãy bỏ qua email này.`,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`Resend request failed with status ${response.status}.`);
    }
  }
}

export function createEmailSender(): EmailSender {
  const provider = process.env.EMAIL_PROVIDER?.trim().toLowerCase();
  if (process.env.NODE_ENV !== "production" || !provider || provider === "console") {
    return new ConsoleEmailSender();
  }
  if (provider === "resend") return new ResendEmailSender();
  throw new Error("EMAIL_PROVIDER must be console or resend.");
}
