import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { completePasswordReset } from "@/lib/password-reset";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Liên kết hoặc mật khẩu không hợp lệ hoặc đã hết hạn." },
      { status: 400 },
    );
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Liên kết hoặc mật khẩu không hợp lệ hoặc đã hết hạn." },
      { status: 400 },
    );
  }

  const { token, password } = body as { token?: unknown; password?: unknown };
  if (typeof token !== "string" || typeof password !== "string") {
    return NextResponse.json(
      { error: "Liên kết hoặc mật khẩu không hợp lệ hoặc đã hết hạn." },
      { status: 400 },
    );
  }

  try {
    const reset = await completePasswordReset(prisma, { token, password });
    if (!reset) {
      return NextResponse.json(
        { error: "Liên kết hoặc mật khẩu không hợp lệ hoặc đã hết hạn." },
        { status: 400 },
      );
    }
  } catch {
    console.error("Password reset completion failed.");
    return NextResponse.json(
      { error: "Không thể đặt lại mật khẩu lúc này. Vui lòng thử lại." },
      { status: 500 },
    );
  }

  return NextResponse.json({ message: "Mật khẩu đã được cập nhật." });
}
