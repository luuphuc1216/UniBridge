import { NextResponse } from "next/server";
import { createEmailSender } from "@/lib/email-sender";
import { prisma } from "@/lib/prisma";
import { requestPasswordReset } from "@/lib/password-reset";
import { getTrustedClientIp } from "@/lib/rate-limit";

const genericResponse = {
  message: "Nếu email tồn tại, hướng dẫn đặt lại mật khẩu sẽ được gửi.",
};

export async function POST(request: Request) {
  let email = "";
  try {
    const body: unknown = await request.json();
    if (body && typeof body === "object" && !Array.isArray(body)) {
      const value = (body as { email?: unknown }).email;
      if (typeof value === "string") email = value;
    }

    const appUrl =
      process.env.APP_URL ||
      (process.env.NODE_ENV === "production"
        ? "https://unibridge.id.vn"
        : "http://localhost:3000");
    const baseUrl = new URL(appUrl);
    if (baseUrl.protocol !== "https:" && baseUrl.protocol !== "http:") {
      throw new Error("APP_URL must use HTTP or HTTPS.");
    }
    await requestPasswordReset(prisma, {
      email,
      ip: getTrustedClientIp(request.headers),
      baseUrl: baseUrl.origin,
      emailSender: createEmailSender(),
    });
  } catch {
    console.error("Password reset request failed.");
  }
  return NextResponse.json(genericResponse, { status: 200 });
}
