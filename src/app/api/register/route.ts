import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureFreePostCredits } from "@/lib/post-credits";
import type { SelfRegistrationRole } from "@/lib/roles";

type RegistrationInput = {
  name?: unknown;
  email?: unknown;
  password?: unknown;
  role?: unknown;
  companyName?: unknown;
  industry?: unknown;
  description?: unknown;
  major?: unknown;
  university?: unknown;
};

function getText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function invalidRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(request: Request) {
  let body: RegistrationInput;
  try {
    body = (await request.json()) as RegistrationInput;
  } catch {
    return invalidRequest("Dữ liệu gửi lên không hợp lệ.");
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return invalidRequest("Dữ liệu gửi lên không hợp lệ.");
  }

  const name = getText(body.name);
  const email = getText(body.email).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const role = body.role;

  if (name.length < 2 || name.length > 100) {
    return invalidRequest("Họ và tên cần có từ 2 đến 100 ký tự.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return invalidRequest("Vui lòng nhập địa chỉ email hợp lệ.");
  }
  if (
    password.trim().length < 8 ||
    new TextEncoder().encode(password).length > 72
  ) {
    return invalidRequest("Mật khẩu cần có ít nhất 8 ký tự và tối đa 72 byte.");
  }
  if (role !== "BUSINESS" && role !== "STUDENT") {
    return invalidRequest("Vui lòng chọn vai trò Doanh nghiệp hoặc Sinh viên.");
  }

  const registrationRole: SelfRegistrationRole = role;
  const companyName = getText(body.companyName);
  const industry = getText(body.industry);
  const description = getText(body.description);
  const major = getText(body.major);
  const university = getText(body.university);

  if (
    registrationRole === "BUSINESS" &&
    (companyName.length < 2 || industry.length < 2 || description.length < 10)
  ) {
    return invalidRequest(
      "Vui lòng nhập tên doanh nghiệp, lĩnh vực và mô tả (ít nhất 10 ký tự).",
    );
  }
  if (
    registrationRole === "STUDENT" &&
    (major.length < 2 || university.length < 2)
  ) {
    return invalidRequest("Vui lòng nhập chuyên ngành và trường đại học.");
  }

  const passwordHash = await hash(password, 12);

  try {
    const user = await prisma.$transaction(async (transaction) => {
      const createdUser = await transaction.user.create({
        data: { name, email, passwordHash, role: registrationRole },
      });

      if (registrationRole === "BUSINESS") {
        const profile = await transaction.businessProfile.create({
          data: { userId: createdUser.id, companyName, industry, description },
        });
        await ensureFreePostCredits(transaction, profile.id);
      } else {
        await transaction.studentProfile.create({
          data: { userId: createdUser.id, major, university },
        });
      }

      return createdUser;
    });

    return NextResponse.json(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      { status: 201 },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Email này đã được sử dụng." },
        { status: 409 },
      );
    }
    throw error;
  }
}
