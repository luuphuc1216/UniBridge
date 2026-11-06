import type { PrismaClient } from "@/generated/prisma/client";
import { getBusinessCloseBlockReason } from "@/lib/problem-workflow";

type CloseDatabase = Pick<PrismaClient, "$transaction">;

export type CloseProblemCoreHooks = {
  beforeNotifications?: () => void | Promise<void>;
  beforeAuditLog?: () => void | Promise<void>;
};

export async function closeProblemCore(
  userId: string,
  businessProfileId: string,
  problemId: string,
  database: CloseDatabase,
  hooks?: CloseProblemCoreHooks,
) {
  return database.$transaction(async (transaction) => {
    const problem = await transaction.problem.findFirst({
      where: {
        id: problemId,
        businessProfileId,
        businessProfile: { userId },
        status: { in: ["APPROVED", "PUBLISHED"] },
      },
      select: { id: true, title: true },
    });
    if (!problem) throw new Error("Chỉ có thể đóng bài toán đã được duyệt và đang mở.");
    const pendingInvitation = await transaction.applicationInvitation.findFirst({
      where: { problemId, status: "PENDING_CONFIRMATION" }, select: { id: true },
    });
    const runningProject = await transaction.project.findFirst({
      where: { application: { problemId }, status: { in: ["AGREEING", "PROTOTYPING", "IN_PROGRESS"] } },
      select: { id: true },
    });
    const selected = await transaction.application.findFirst({
      where: { problemId, status: "SELECTED" }, select: { id: true },
    });
    const pendingReason = getBusinessCloseBlockReason({
      hasPendingInvitation: Boolean(pendingInvitation),
      hasSelectedApplication: Boolean(selected),
      hasRunningProject: Boolean(runningProject),
    });
    if (pendingReason) throw new Error(pendingReason);
    const affectedApplications = await transaction.application.findMany({
      where: { problemId, status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
      select: { team: { select: { ownerId: true, memberships: { select: { studentProfile: { select: { userId: true } } } } } } },
    });
    await transaction.application.updateMany({
      where: { problemId, status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
      data: { status: "NOT_SELECTED" },
    });
    const studentUserIds = [...new Set(
      affectedApplications.flatMap(({ team }) => [
        team.ownerId,
        ...team.memberships.map(({ studentProfile }) => studentProfile?.userId),
      ]).filter((id): id is string => Boolean(id)),
    )];
    await hooks?.beforeNotifications?.();
    if (studentUserIds.length > 0) {
      await transaction.notification.createMany({
        data: studentUserIds.map((id) => ({
          userId: id,
          title: "Bài toán đã đóng",
          message: `Bài toán “${problem.title}” đã được doanh nghiệp đóng và hồ sơ của nhóm không được chọn.`,
          href: `/student/problems/${problemId}`,
        })),
      });
    }
    await transaction.problem.update({
      where: { id: problemId },
      data: { status: "CLOSED", closedReason: "BUSINESS_CLOSED", closedAt: new Date() },
    });
    await hooks?.beforeAuditLog?.();
    await transaction.auditLog.create({
      data: {
        actorId: userId,
        action: "BUSINESS_CLOSED_PROBLEM",
        targetType: "Problem",
        targetId: problemId,
        metadata: JSON.stringify({ title: problem.title }),
      },
    });
  });
}
