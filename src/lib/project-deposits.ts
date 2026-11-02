import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import {
  businessFeeRate,
  legacyPlatformFeeRate,
  studentFeeRate,
} from "@/lib/project-config";
import {
  calculateLegacyProjectFinancialBreakdown,
  calculateProjectFinancialBreakdown,
  type ProjectFinancialBreakdown,
} from "@/lib/project-money";
import {
  getAcceptedProjectAgreementSnapshot,
  type AgreementSnapshot,
} from "@/lib/project-agreements";
import { getProjectTeamUserIds } from "@/lib/project-access";
import {
  assertProjectActionable,
  transitionPaidMilestone,
} from "@/lib/project-milestone-workflow";
import { getProjectNotificationHref } from "@/lib/project-notification-links";

type DepositDatabase = Pick<PrismaClient, "$transaction" | "projectTransaction">;

export function assertBusinessCanDeposit(role: string): void {
  if (role !== "BUSINESS") {
    throw new Error("Chỉ doanh nghiệp sở hữu dự án mới có thể nạp tiền.");
  }
}

export async function recordProjectDeposit(
  database: DepositDatabase,
  {
    projectId,
    idempotencyKey = `deposit:${projectId}`,
    now = new Date(),
  }: { projectId: string; idempotencyKey?: string; now?: Date },
): Promise<{ breakdown: ProjectFinancialBreakdown; alreadyDeposited: boolean }> {
  if (!idempotencyKey.trim()) throw new Error("Idempotency key không hợp lệ.");
  const alreadyDepositedResult = (
    amount: number,
    platformFeeBasisPoints: number,
  ): { breakdown: ProjectFinancialBreakdown; alreadyDeposited: true } => ({
    breakdown: {
      totalAmount: 0,
      totalBusinessFee: 0,
      totalStudentFee: 0,
      totalPlatformFee: 0,
      totalDeposit: amount,
      totalTeamAmount: 0,
      businessFeeBasisPoints: null,
      studentFeeBasisPoints: null,
      platformFeeBasisPoints,
      milestones: [],
    },
    alreadyDeposited: true,
  });
  try {
    return await database.$transaction(async (transaction) => {
      const project = await transaction.project.findUnique({
        where: { id: projectId },
        include: {
          milestones: { orderBy: { sortOrder: "asc" } },
          team: {
            select: {
              ownerId: true,
              memberships: {
                select: { studentProfile: { select: { userId: true } } },
              },
            },
          },
          application: {
            select: {
              problem: {
                select: {
                  title: true,
                  businessProfile: { select: { userId: true } },
                },
              },
            },
          },
        },
      });
      if (!project) throw new Error("Không tìm thấy dự án cần nạp tiền.");
      assertProjectActionable(project);
      const existing = await transaction.projectTransaction.findFirst({
        where: { projectId, type: "DEPOSIT" },
      });
      if (existing) {
        return alreadyDepositedResult(existing.amount, existing.platformFeeBasisPoints);
      }
      if (project.status !== "AWAITING_PAYMENT") {
        throw new Error("Dự án chưa được hai bên đồng ý hoặc đã nạp tiền.");
      }

      let totalAmount = project.totalAmount;
      let milestonePercentages = project.milestones.map(({ paymentPercent }) => paymentPercent);
      let breakdown: ProjectFinancialBreakdown;
      let acceptedSnapshot: AgreementSnapshot | null = null;
      if (project.legacyTermsExempt) {
        if (!project.businessAcceptedAt || !project.teamAcceptedAt) {
          throw new Error("Dự án legacy chưa được hai bên đồng ý.");
        }
        breakdown = calculateLegacyProjectFinancialBreakdown(
          totalAmount,
          milestonePercentages,
          legacyPlatformFeeRate,
        );
      } else {
        acceptedSnapshot = await getAcceptedProjectAgreementSnapshot(transaction, projectId);
        totalAmount = acceptedSnapshot.totalAmount;
        milestonePercentages = acceptedSnapshot.milestones.map(
          ({ paymentPercent }) => paymentPercent,
        );
        if (acceptedSnapshot.milestones.length !== project.milestones.length) {
          throw new Error("Danh sách Milestone không khớp phiên bản đã xác nhận.");
        }
        breakdown = calculateProjectFinancialBreakdown(
          totalAmount,
          milestonePercentages,
          businessFeeRate,
          studentFeeRate,
        );
        for (const [index, snapshotMilestone] of acceptedSnapshot.milestones.entries()) {
          const currentMilestone = project.milestones[index];
          const allocation = breakdown.milestones[index];
          if (!currentMilestone || !allocation) {
            throw new Error("Không thể đối chiếu Milestone với phiên bản đã xác nhận.");
          }
          const restored = await transaction.milestone.updateMany({
            where: {
              id: currentMilestone.id,
              projectId,
              status: "PENDING",
            },
            data: {
              title: snapshotMilestone.title,
              description: snapshotMilestone.description,
              acceptanceCriteria: snapshotMilestone.acceptanceCriteria,
              paymentPercent: snapshotMilestone.paymentPercent,
              amount: allocation.grossAmount,
              dueAt: new Date(`${snapshotMilestone.dueAt}T12:00:00.000Z`),
            },
          });
          if (restored.count !== 1) {
            throw new Error("Milestone đã thay đổi sau khi xác nhận thỏa thuận.");
          }
        }
      }

      const changed = await transaction.project.updateMany({
        where: {
          id: projectId,
          status: "AWAITING_PAYMENT",
          ...(project.legacyTermsExempt
            ? {
                legacyTermsExempt: true,
                businessAcceptedAt: { not: null },
                teamAcceptedAt: { not: null },
              }
            : { legacyTermsExempt: false }),
          transactions: { none: { type: "DEPOSIT" } },
        },
        data: {
          status: "IN_PROGRESS",
          startedAt: now,
          ...(acceptedSnapshot
            ? {
                title: acceptedSnapshot.title,
                agreedScope: acceptedSnapshot.agreedScope,
                deliverables: acceptedSnapshot.deliverables,
                duration: acceptedSnapshot.duration,
                totalAmount,
                generalAcceptanceCriteria: acceptedSnapshot.generalAcceptanceCriteria,
                businessResponsibilities: acceptedSnapshot.businessResponsibilities,
                teamResponsibilities: acceptedSnapshot.teamResponsibilities,
                paymentMethod: acceptedSnapshot.paymentMethod,
              }
            : {}),
        },
      });
      if (changed.count !== 1) throw new Error("Dự án đã được nạp tiền.");
      const firstMilestone = project.milestones[0];
      if (!firstMilestone) throw new Error("Dự án chưa có Milestone.");
      if (acceptedSnapshot) {
        for (const milestone of project.milestones) {
          await transitionPaidMilestone(transaction, {
            projectId,
            milestone,
            acceptanceStatus: "NOT_SUBMITTED",
            paymentStatus: "ESCROW",
            started: false,
          });
        }
        await transaction.projectWorkflowEvent.create({
          data: {
            projectId,
            actorUserId: project.application.problem.businessProfile.userId,
            eventType: "PROJECT_DEPOSIT_RECORDED",
            fromStatus: "AWAITING_PAYMENT",
            toStatus: "IN_PROGRESS",
            detailsJson: JSON.stringify({ transactionId: idempotencyKey }),
            idempotencyKey: `project-deposit:${projectId}`,
            createdAt: now,
          },
        });
      } else {
        const opened = await transaction.milestone.updateMany({
          where: { id: firstMilestone.id, projectId, status: "PENDING" },
          data: { status: "IN_PROGRESS" },
        });
        if (opened.count !== 1) throw new Error("Không thể mở Milestone đầu tiên.");
      }

      await transaction.projectTransaction.create({
        data: {
          projectId,
          idempotencyKey,
          type: "DEPOSIT",
          amount: breakdown.totalDeposit,
          platformFee: breakdown.totalPlatformFee,
          platformFeeBasisPoints: breakdown.platformFeeBasisPoints,
          businessFeeBasisPoints: project.legacyTermsExempt ? null : businessFeeRate,
          studentFeeBasisPoints: project.legacyTermsExempt ? null : studentFeeRate,
          businessFee: project.legacyTermsExempt ? null : breakdown.totalBusinessFee,
          status: "ESCROW",
          paidAt: now,
        },
      });
      const recipients = getProjectTeamUserIds(project.team);
      await transaction.notification.createMany({
        data: [
          {
            userId: project.application.problem.businessProfile.userId,
            title: "Đã nạp tiền vào escrow giả lập",
            message: `Khoản nạp ${breakdown.totalDeposit.toLocaleString("vi-VN")} ₫ cho dự án “${project.title}” đã được ghi nhận giả lập.`,
            href: getProjectNotificationHref("BUSINESS", projectId),
            createdAt: now,
          },
          ...recipients.map((userId) => ({
            userId,
            title: "Doanh nghiệp đã nạp tiền",
            message: `Dự án “${project.title}” đã bắt đầu. Milestone đầu tiên đang mở.`,
            href: getProjectNotificationHref("STUDENT", projectId),
            createdAt: now,
          })),
        ],
      });
      return { breakdown, alreadyDeposited: false };
    });
  } catch (error) {
    const isDepositConflict =
      (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") ||
      (error instanceof Error && error.message === "Dự án đã được nạp tiền.");
    if (!isDepositConflict) throw error;
    const existing = await database.projectTransaction.findFirst({
      where: { projectId, type: "DEPOSIT" },
    });
    if (existing) {
      return alreadyDepositedResult(existing.amount, existing.platformFeeBasisPoints);
    }
    throw error;
  }
}
