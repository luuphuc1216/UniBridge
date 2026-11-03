import { createHash, randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import type { PrismaClient } from "@/generated/prisma/client";
import { writeAuditLog } from "./audit-log";
import type { EmailSender } from "./email-sender";
import { consumeRateLimit } from "./rate-limit";

const resetLifetimeMs = 30 * 60 * 1000;
const passwordMaxBytes = 72;

function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function requestPasswordReset(
  client: PrismaClient,
  {
    email,
    ip,
    baseUrl,
    emailSender,
    now = new Date(),
  }: {
    email: string;
    ip: string | null;
    baseUrl: string;
    emailSender: EmailSender;
    now?: Date;
  },
): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail.length > 254) return;

  const withinLimits = await client.$transaction(async (transaction) => {
    const emailAllowed = await consumeRateLimit(transaction, {
      scope: "password-reset-email",
      identifier: normalizedEmail,
      limit: 3,
      windowMs: 60 * 60 * 1000,
      now,
    });
    const ipAllowed = ip
      ? await consumeRateLimit(transaction, {
          scope: "password-reset-ip",
          identifier: ip,
          limit: 10,
          windowMs: 60 * 60 * 1000,
          now,
        })
      : true;
    return emailAllowed && ipAllowed;
  });
  if (!withinLimits) return;

  const user = await client.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, name: true, email: true },
  });
  if (!user) return;

  const rawToken = randomBytes(32).toString("base64url");
  await client.$transaction(async (transaction) => {
    await transaction.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: now },
    });
    await transaction.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashResetToken(rawToken),
        expiresAt: new Date(now.getTime() + resetLifetimeMs),
      },
    });
  });

  await emailSender.sendPasswordReset({
    email: user.email,
    name: user.name,
    token: rawToken,
    resetUrl: `${baseUrl}/dat-lai-mat-khau?token=${encodeURIComponent(rawToken)}`,
  });
}

export async function completePasswordReset(
  client: PrismaClient,
  {
    token,
    password,
    now = new Date(),
  }: { token: string; password: string; now?: Date },
): Promise<boolean> {
  if (
    token.length > 256 ||
    password.trim().length < 8 ||
    new TextEncoder().encode(password).length > passwordMaxBytes
  ) {
    return false;
  }
  const tokenHash = hashResetToken(token);
  const reset = await client.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });
  if (!reset || reset.usedAt || reset.expiresAt <= now) return false;

  const passwordHash = await hash(password, 12);
  return client.$transaction(async (transaction) => {
    const claimed = await transaction.passwordResetToken.updateMany({
      where: {
        id: reset.id,
        tokenHash,
        userId: reset.userId,
        usedAt: null,
        expiresAt: { gt: now },
      },
      data: { usedAt: now },
    });
    if (claimed.count !== 1) return false;

    const updated = await transaction.user.updateMany({
      where: { id: reset.userId },
      data: { passwordHash, authVersion: { increment: 1 } },
    });
    if (updated.count !== 1) return false;

    await transaction.passwordResetToken.updateMany({
      where: { userId: reset.userId, usedAt: null },
      data: { usedAt: now },
    });
    await writeAuditLog(transaction, {
      actorId: reset.userId,
      action: "PASSWORD_RESET",
      targetType: "User",
      targetId: reset.userId,
    });
    return true;
  });
}

export const passwordResetLimits = {
  emailPerHour: 3,
  ipPerHour: 10,
  loginFailuresPerEmail: 10,
  loginWindowMinutes: 15,
};
