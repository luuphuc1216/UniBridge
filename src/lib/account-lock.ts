import type { PrismaClient } from "@/generated/prisma/client";
import { writeAuditLog } from "./audit-log";

export type AccountStatusChangeResult =
  | "updated"
  | "unchanged"
  | "missing"
  | "self"
  | "last-admin"
  | "conflict";

export async function changeAccountStatus(
  client: PrismaClient,
  {
    actorId,
    targetId,
    desiredStatus,
    reason,
    now = new Date(),
  }: {
    actorId: string;
    targetId: string;
    desiredStatus: "ACTIVE" | "LOCKED";
    reason: string;
    now?: Date;
  },
): Promise<AccountStatusChangeResult> {
  if (reason.trim().length < 3 || reason.trim().length > 1000) {
    throw new Error("Lý do cần có từ 3 đến 1.000 ký tự.");
  }

  try {
    return await client.$transaction(async (transaction) => {
      const target = await transaction.user.findUnique({
        where: { id: targetId },
        select: { id: true, role: true, accountStatus: true, authVersion: true },
      });
      if (!target) return "missing";
      if (desiredStatus === "LOCKED" && target.id === actorId) return "self";
      if (target.accountStatus === desiredStatus) return "unchanged";

      if (
        desiredStatus === "LOCKED" &&
        target.role === "ADMIN" &&
        target.accountStatus === "ACTIVE" &&
        (await transaction.user.count({
          where: { role: "ADMIN", accountStatus: "ACTIVE" },
        })) <= 1
      ) {
        return "last-admin";
      }

      const updated = await transaction.user.updateMany({
        where: {
          id: target.id,
          role: target.role,
          accountStatus: target.accountStatus,
          authVersion: target.authVersion,
        },
        data: {
          accountStatus: desiredStatus,
          authVersion: { increment: 1 },
          lockedAt: desiredStatus === "LOCKED" ? now : null,
          lockReason: desiredStatus === "LOCKED" ? reason.trim() : null,
        },
      });
      if (updated.count !== 1) return "conflict";

      if (desiredStatus === "LOCKED" && target.role === "ADMIN") {
        const remainingAdmins = await transaction.user.count({
          where: { role: "ADMIN", accountStatus: "ACTIVE" },
        });
        if (remainingAdmins < 1) throw new Error("LAST_ACTIVE_ADMIN");
      }

      await writeAuditLog(transaction, {
        actorId,
        action: desiredStatus === "LOCKED" ? "ACCOUNT_LOCKED" : "ACCOUNT_UNLOCKED",
        targetType: "User",
        targetId: target.id,
        metadata: { reason: reason.trim() },
      });
      return "updated";
    });
  } catch (error) {
    if (error instanceof Error && error.message === "LAST_ACTIVE_ADMIN") {
      return "last-admin";
    }
    throw error;
  }
}
