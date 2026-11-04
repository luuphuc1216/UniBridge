import { hash } from "bcryptjs";
import type { PrismaClient } from "@/generated/prisma/client";
import { writeAuditLog } from "./audit-log";

export class AdminBootstrapError extends Error {}

export async function createInitialAdmin(
  database: PrismaClient,
  input: { email: string; name: string; password: string },
): Promise<{ id: string; email: string; name: string }> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new AdminBootstrapError("ADMIN_EMAIL không hợp lệ.");
  }
  if (name.length < 2 || name.length > 100) {
    throw new AdminBootstrapError("ADMIN_NAME cần có từ 2 đến 100 ký tự.");
  }
  if (
    Array.from(input.password.trim()).length < 12 ||
    new TextEncoder().encode(input.password).length > 72
  ) {
    throw new AdminBootstrapError(
      "Mật khẩu cần có ít nhất 12 ký tự và tối đa 72 byte.",
    );
  }

  const passwordHash = await hash(input.password, 12);

  try {
    return await database.$transaction(async (transaction) => {
      const existingAdmin = await transaction.user.findFirst({
        where: { role: "ADMIN" },
        select: { id: true },
      });
      if (existingAdmin) {
        throw new AdminBootstrapError("Đã tồn tại tài khoản Admin.");
      }

      const existingUser = await transaction.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (existingUser) {
        throw new AdminBootstrapError("Email đã được sử dụng.");
      }

      const user = await transaction.user.create({
        data: {
          email,
          name,
          passwordHash,
          role: "ADMIN",
          accountStatus: "ACTIVE",
          authVersion: 0,
        },
        select: { id: true, email: true, name: true },
      });

      await writeAuditLog(transaction, {
        actorId: user.id,
        action: "ADMIN_BOOTSTRAPPED",
        targetType: "User",
        targetId: user.id,
        metadata: { source: "production-bootstrap" },
      });

      return user;
    });
  } catch (error) {
    if (error instanceof AdminBootstrapError) throw error;
    throw new AdminBootstrapError("Không thể tạo tài khoản Admin.");
  }
}
