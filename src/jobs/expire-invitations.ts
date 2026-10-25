import "dotenv/config";

import { prisma } from "@/lib/prisma";
import {
  shouldExpireInvitation,
  shouldSendInvitationReminder,
} from "@/lib/problem-workflow";

export async function expireInvitations(now = new Date()): Promise<number> {
  await sendDueReminders(now);
  const invitations = await prisma.applicationInvitation.findMany({
    where: {
      status: "PENDING_CONFIRMATION",
      expiresAt: { lte: now },
    },
    select: { id: true, applicationId: true, problemId: true },
  });

  let count = 0;
  for (const invitation of invitations) {
    const expired = await prisma.$transaction(async (transaction) => {
      const current = await transaction.applicationInvitation.findUnique({
        where: { id: invitation.id },
        select: { status: true, expiresAt: true, applicationId: true, problemId: true },
      });
      if (!current || !shouldExpireInvitation(current.status, current.expiresAt, now)) {
        return false;
      }

      const application = await transaction.application.findUnique({
        where: { id: current.applicationId },
        select: {
          status: true,
          problem: { select: { title: true, businessProfile: { select: { userId: true } } } },
        },
      });
      if (!application || application.status !== "PENDING_CONFIRMATION") {
        return false;
      }

      await transaction.application.update({
        where: { id: current.applicationId },
        data: { status: "EXPIRED" },
      });
      await transaction.applicationInvitation.update({
        where: { id: invitation.id },
        data: {
          status: "EXPIRED",
          respondedAt: now,
          responseStatus: "EXPIRED",
          responseReason: "Hết hạn phản hồi",
        },
      });
      await transaction.notification.create({
        data: {
          userId: application.problem.businessProfile.userId,
          title: "Lời mời hợp tác đã hết hạn",
          message: `Lời mời cho bài toán “${application.problem.title}” đã hết hạn.`,
          href: `/business/problems/${current.problemId}/applications`,
        },
      });
      return true;
    });
    if (expired) count += 1;
  }
  return count;
}

async function sendDueReminders(now: Date) {
  const due = await prisma.applicationInvitation.findMany({
    where: {
      status: "PENDING_CONFIRMATION",
      reminderAt: { lte: now },
      reminderSentAt: null,
    },
    select: {
      id: true,
      reminderAt: true,
      problem: { select: { title: true } },
      team: {
        select: {
          ownerId: true,
          memberships: { select: { studentProfile: { select: { userId: true } } } },
        },
      },
    },
  });
  for (const invitation of due) {
    await prisma.$transaction(async (transaction) => {
      const current = await transaction.applicationInvitation.findUnique({
        where: { id: invitation.id },
        select: { status: true, reminderSentAt: true },
      });
      if (
        !current ||
        !shouldSendInvitationReminder(
          current.status,
          invitation.reminderAt,
          current.reminderSentAt,
          now,
        )
      ) {
        return;
      }
      const userIds = [
        invitation.team.ownerId,
        ...invitation.team.memberships.map(({ studentProfile }) => studentProfile?.userId),
      ].filter((userId): userId is string => Boolean(userId));
      await transaction.notification.createMany({
        data: [...new Set(userIds)].map((userId) => ({
          userId,
          title: "Lời mời hợp tác sắp hết hạn",
          message: `Bạn còn thời gian phản hồi lời mời cho bài toán “${invitation.problem.title}”.`,
          href: "/student/applications",
        })),
      });
      await transaction.applicationInvitation.update({
        where: { id: invitation.id },
        data: { reminderSentAt: now },
      });
    });
  }
}

async function main() {
  const count = await expireInvitations();
  console.log(`Đã xử lý ${count} lời mời hết hạn.`);
}

if (process.argv[1]?.endsWith("expire-invitations.ts")) {
  main().catch((error) => {
    console.error("Xử lý hết hạn lời mời thất bại:", error);
    process.exitCode = 1;
  });
}
