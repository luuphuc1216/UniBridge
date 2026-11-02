import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import {
  legacyPlatformFeeRate,
  studentFeeRate,
} from "@/lib/project-config";
import {
  calculateLegacyProjectFinancialBreakdown,
  calculateProjectFinancialBreakdown,
} from "@/lib/project-money";
import { getProjectTeamUserIds } from "@/lib/project-access";
import {
  projectReminderConfig,
  projectReminderHourMs,
} from "@/lib/project-reminder-config";
import { canRespondForTeam } from "@/lib/team-permissions";
import { getProjectNotificationHref } from "@/lib/project-notification-links";

type WorkflowTransaction = Prisma.TransactionClient;

const acceptanceStatuses = [
  "NOT_SUBMITTED",
  "AWAITING_ACCEPTANCE",
  "NEEDS_REVISION",
  "ACCEPTED",
] as const;
const paymentStatuses = ["UNFUNDED", "ESCROW", "RELEASED", "REFUNDED"] as const;

type AcceptanceStatus = (typeof acceptanceStatuses)[number];
type PaymentStatus = (typeof paymentStatuses)[number];

export function assertProjectActionable(project: { status: string }): void {
  if (project.status === "CANCELLED" || project.status === "COMPLETED") {
    throw new Error("Dự án đã kết thúc; không thể thực hiện thao tác này.");
  }
}

export function assertMilestoneMoneyActionable(
  milestone: { status: string; paymentStatus: string },
  project: { status: string; pausedAt: Date | null },
): void {
  assertProjectActionable(project);
  if (project.pausedAt) {
    throw new Error("Dự án đang tạm dừng; chưa thể nghiệm thu hoặc giải ngân.");
  }
  if (milestone.status === "DISPUTED") {
    throw new Error("Milestone đang có bất đồng; chưa thể nghiệm thu hoặc giải ngân.");
  }
  if (milestone.status === "CANCELLED" || milestone.paymentStatus === "REFUNDED") {
    throw new Error("Milestone đã bị hủy hoặc hoàn tiền.");
  }
  if (milestone.paymentStatus === "RELEASED") {
    throw new Error("Milestone đã giải ngân.");
  }
}

export type PaidMilestoneState = {
  status: string;
  acceptanceStatus: string;
  paymentStatus: string;
};

function assertPaidState(
  acceptanceStatus: string,
  paymentStatus: string,
): asserts acceptanceStatus is AcceptanceStatus {
  if (
    !acceptanceStatuses.includes(acceptanceStatus as AcceptanceStatus) ||
    !paymentStatuses.includes(paymentStatus as PaymentStatus) ||
    (paymentStatus === "UNFUNDED" && acceptanceStatus !== "NOT_SUBMITTED") ||
    (paymentStatus === "RELEASED" && acceptanceStatus !== "ACCEPTED") ||
    (paymentStatus === "ESCROW" && acceptanceStatus === "ACCEPTED") ||
    (paymentStatus === "REFUNDED" && acceptanceStatus !== "NOT_SUBMITTED")
  ) {
    throw new Error("Trạng thái nghiệm thu và thanh toán Milestone không hợp lệ.");
  }
}

export function derivePaidMilestoneStatus(
  acceptanceStatus: string,
  paymentStatus: string,
  started: boolean,
): string {
  assertPaidState(acceptanceStatus, paymentStatus);
  if (paymentStatus === "REFUNDED") return "CANCELLED";
  if (acceptanceStatus === "AWAITING_ACCEPTANCE") return "AWAITING_ACCEPTANCE";
  if (acceptanceStatus === "NEEDS_REVISION") return "NEEDS_REVISION";
  if (acceptanceStatus === "ACCEPTED") return "ACCEPTED";
  return started && paymentStatus === "ESCROW" ? "IN_PROGRESS" : "NOT_STARTED";
}

export async function transitionPaidMilestone(
  transaction: WorkflowTransaction,
  {
    projectId,
    milestone,
    acceptanceStatus,
    paymentStatus,
    started,
    data = {},
  }: {
    projectId: string;
    milestone: PaidMilestoneState & { id: string };
    acceptanceStatus: AcceptanceStatus;
    paymentStatus: PaymentStatus;
    started: boolean;
    data?: Prisma.MilestoneUpdateManyMutationInput;
  },
): Promise<void> {
  assertPaidState(milestone.acceptanceStatus, milestone.paymentStatus);
  assertPaidState(acceptanceStatus, paymentStatus);
  const changed = await transaction.milestone.updateMany({
    where: {
      id: milestone.id,
      projectId,
      status: milestone.status,
      acceptanceStatus: milestone.acceptanceStatus,
      paymentStatus: milestone.paymentStatus,
    },
    data: {
      ...data,
      acceptanceStatus,
      paymentStatus,
      status: derivePaidMilestoneStatus(acceptanceStatus, paymentStatus, started),
    },
  });
  if (changed.count !== 1) {
    throw new Error("Milestone đã thay đổi. Vui lòng tải lại trang.");
  }
}

type WorkflowDatabase = Pick<PrismaClient, "$transaction" | "project" | "projectTransaction">;

async function getProjectForMilestoneAction(
  transaction: WorkflowTransaction,
  projectId: string,
  milestoneId: string,
) {
  const milestone = await transaction.milestone.findFirst({
    where: { id: milestoneId, projectId },
    include: {
      project: {
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
            include: {
              problem: {
                select: {
                  id: true,
                  title: true,
                  status: true,
                  businessProfile: { select: { userId: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!milestone) throw new Error("Không tìm thấy Milestone trong dự án.");
  const project = milestone.project;
  assertProjectActionable(project);
  if (project.legacyTermsExempt) {
    throw new Error("Quy trình Milestone mới không áp dụng cho dự án legacy.");
  }
  if (project.status !== "IN_PROGRESS") {
    throw new Error("Dự án chưa được nạp tiền hoặc không còn đang thực hiện.");
  }
  if (project.pausedAt) {
    throw new Error("Dự án đang tạm dừng; chưa thể cập nhật tiến độ, nộp hoặc nghiệm thu Milestone.");
  }
  const escrow = await transaction.projectTransaction.findFirst({
    where: { projectId, type: "DEPOSIT", status: "ESCROW" },
    select: { id: true },
  });
  if (!escrow) throw new Error("Không tìm thấy khoản nạp escrow đang hiệu lực.");
  const orderedMilestones = project.milestones;
  const currentIndex = orderedMilestones.findIndex(({ id }) => id === milestoneId);
  if (
    currentIndex < 0 ||
    orderedMilestones
      .slice(0, currentIndex)
      .some(
        ({ acceptanceStatus, paymentStatus, status }) =>
          acceptanceStatus !== "ACCEPTED" &&
          !(status === "CANCELLED" && paymentStatus === "REFUNDED") &&
          status !== "DISPUTED",
      )
  ) {
    throw new Error("Cần xử lý Milestone trước đó theo đúng thứ tự.");
  }
  const firstPending = orderedMilestones.find(
    ({ acceptanceStatus, paymentStatus, status }) =>
      acceptanceStatus !== "ACCEPTED" &&
      !(status === "CANCELLED" && paymentStatus === "REFUNDED") &&
      status !== "DISPUTED",
  );
  if (firstPending?.id !== milestoneId) {
    throw new Error("Chỉ có thể thao tác với Milestone đang mở theo thứ tự.");
  }
  return { milestone, project, escrow };
}

export async function updatePaidMilestoneProgress(
  database: WorkflowDatabase,
  {
    projectId,
    milestoneId,
    actorUserId,
    progressPercent,
    workCompleted,
    difficulties,
    now = new Date(),
  }: {
    projectId: string;
    milestoneId: string;
    actorUserId: string;
    progressPercent: number;
    workCompleted: string;
    difficulties: string;
    now?: Date;
  },
): Promise<void> {
  if (!Number.isInteger(progressPercent) || progressPercent < 0 || progressPercent > 100) {
    throw new Error("Tiến độ phải là số nguyên từ 0 đến 100%.");
  }
  if (!workCompleted.trim() || workCompleted.length > 10_000 || difficulties.length > 4_000) {
    throw new Error("Vui lòng mô tả công việc đã làm (tối đa 10.000 ký tự) và khó khăn (tối đa 4.000 ký tự).");
  }
  await database.$transaction(async (transaction) => {
    const { milestone, project } = await getProjectForMilestoneAction(
      transaction,
      projectId,
      milestoneId,
    );
    if (!canRespondForTeam(project.team.ownerId, actorUserId)) {
      throw new Error("Chỉ chủ nhóm của dự án mới có thể cập nhật tiến độ.");
    }
    assertProjectActionable(project);
    if (
      !["PENDING", "NOT_STARTED", "IN_PROGRESS", "NEEDS_REVISION"].includes(milestone.status) ||
      milestone.acceptanceStatus === "AWAITING_ACCEPTANCE"
    ) {
      throw new Error("Milestone này hiện chưa mở để cập nhật tiến độ.");
    }
    const previousState = {
      id: milestone.id,
      status: milestone.status,
      acceptanceStatus: milestone.acceptanceStatus,
      paymentStatus: milestone.paymentStatus,
    };
    await transitionPaidMilestone(transaction, {
      projectId,
      milestone: previousState,
      acceptanceStatus: "NOT_SUBMITTED",
      paymentStatus: "ESCROW",
      started: true,
      data: {
        progressPercent,
        workCompleted: workCompleted.trim(),
        difficulties: difficulties.trim(),
      },
    });
    await transaction.milestoneProgressUpdate.create({
      data: {
        milestoneId,
        progressPercent,
        workCompleted: workCompleted.trim(),
        difficulties: difficulties.trim(),
        createdByUserId: actorUserId,
        createdAt: now,
      },
    });
    await transaction.projectWorkflowEvent.create({
      data: {
        projectId,
        milestoneId,
        actorUserId,
        eventType: "MILESTONE_PROGRESS_UPDATED",
        fromStatus: milestone.status,
        toStatus: "IN_PROGRESS",
        detailsJson: JSON.stringify({ progressPercent }),
        createdAt: now,
      },
    });
  });
}

export async function submitPaidMilestone(
  database: WorkflowDatabase,
  {
    projectId,
    milestoneId,
    actorUserId,
    note,
    links,
    files = [],
    now = new Date(),
  }: {
    projectId: string;
    milestoneId: string;
    actorUserId: string;
    note: string;
    links: string[];
    files?: {
      originalName: string;
      contentType: string;
      sizeBytes: number;
      storageKey: string;
    }[];
    now?: Date;
  },
): Promise<void> {
  await database.$transaction(async (transaction) => {
    const { milestone, project } = await getProjectForMilestoneAction(
      transaction,
      projectId,
      milestoneId,
    );
    if (!canRespondForTeam(project.team.ownerId, actorUserId)) {
      throw new Error("Chỉ chủ nhóm của dự án mới có thể nộp kết quả.");
    }
    assertProjectActionable(project);
    if (
      !["IN_PROGRESS", "NEEDS_REVISION"].includes(milestone.status) ||
      milestone.acceptanceStatus === "AWAITING_ACCEPTANCE"
    ) {
      throw new Error("Milestone này hiện chưa mở để nộp kết quả.");
    }
    if (note.trim().length < 10 || note.length > 10_000) {
      throw new Error("Mô tả kết quả cần ít nhất 10 ký tự và tối đa 10.000 ký tự.");
    }
    const responseDueAt = new Date(
      now.getTime() +
        projectReminderConfig.businessAcceptanceResponseHours * projectReminderHourMs,
    );
    const submission = await transaction.milestoneSubmission.create({
      data: {
        milestoneId,
        submittedById: actorUserId,
        note: note.trim(),
        links: JSON.stringify(links),
        createdAt: now,
        files: { create: files },
      },
    });
    await transitionPaidMilestone(transaction, {
      projectId,
      milestone: {
        id: milestone.id,
        status: milestone.status,
        acceptanceStatus: milestone.acceptanceStatus,
        paymentStatus: milestone.paymentStatus,
      },
      acceptanceStatus: "AWAITING_ACCEPTANCE",
      paymentStatus: "ESCROW",
      started: true,
      data: {
        submittedAt: now,
        responseDueAt,
        revisionFeedback: null,
      },
    });
    await transaction.projectWorkflowEvent.create({
      data: {
        projectId,
        milestoneId,
        actorUserId,
        eventType: "MILESTONE_SUBMITTED",
        fromStatus: milestone.status,
        toStatus: "AWAITING_ACCEPTANCE",
        createdAt: now,
      },
    });
    await transaction.notification.create({
      data: {
        userId: project.application.problem.businessProfile.userId,
        dedupeKey: `milestone-submitted:${submission.id}:business`,
        title: "Nhóm đã nộp kết quả Milestone",
        message: `Nhóm đã nộp kết quả cho “${milestone.title}” của dự án “${project.title}”.`,
        href: getProjectNotificationHref("BUSINESS", projectId),
        createdAt: now,
      },
    });
    const otherTeamUsers = getProjectTeamUserIds(project.team).filter(
      (userId) => userId !== actorUserId,
    );
    await transaction.notification.createMany({
      data: otherTeamUsers.map((userId) => ({
        userId,
        dedupeKey: `milestone-submitted:${submission.id}:${userId}`,
        title: "Nhóm đã nộp kết quả Milestone",
        message: `Đã lưu lần nộp kết quả mới cho “${milestone.title}”.`,
        href: getProjectNotificationHref("STUDENT", projectId),
        createdAt: now,
      })),
    });
  });
}

export async function requestPaidMilestoneRevision(
  database: WorkflowDatabase,
  {
    projectId,
    milestoneId,
    actorUserId,
    feedback,
    now = new Date(),
  }: {
    projectId: string;
    milestoneId: string;
    actorUserId: string;
    feedback: string;
    now?: Date;
  },
): Promise<void> {
  if (!feedback.trim() || feedback.length > 4_000) {
    throw new Error("Vui lòng ghi rõ nội dung cần điều chỉnh (tối đa 4.000 ký tự).");
  }
  await database.$transaction(async (transaction) => {
    const { milestone, project } = await getProjectForMilestoneAction(
      transaction,
      projectId,
      milestoneId,
    );
    if (project.application.problem.businessProfile.userId !== actorUserId) {
      throw new Error("Chỉ doanh nghiệp sở hữu mới có thể phản hồi Milestone.");
    }
    assertProjectActionable(project);
    if (milestone.acceptanceStatus !== "AWAITING_ACCEPTANCE") {
      throw new Error("Chỉ có thể yêu cầu chỉnh sửa kết quả đang chờ nghiệm thu.");
    }
    const acceptedVersion = await transaction.projectAgreementVersion.findFirst({
      where: {
        projectId,
        status: "ACCEPTED",
        businessAcceptedAt: { not: null },
        teamAcceptedAt: { not: null },
      },
      orderBy: { versionNumber: "desc" },
    });
    if (!acceptedVersion) throw new Error("Không tìm thấy phiên bản điều khoản đã ký.");
    if (milestone.revisionCount >= acceptedVersion.maxMilestoneRevisions) {
      throw new Error(
        "Đã hết số lần chỉnh sửa theo thỏa thuận. Hãy lập phiên bản điều khoản mới hoặc mở bất đồng.",
      );
    }
    await transitionPaidMilestone(transaction, {
      projectId,
      milestone: {
        id: milestone.id,
        status: milestone.status,
        acceptanceStatus: milestone.acceptanceStatus,
        paymentStatus: milestone.paymentStatus,
      },
      acceptanceStatus: "NEEDS_REVISION",
      paymentStatus: "ESCROW",
      started: true,
      data: {
        revisionFeedback: feedback.trim(),
        revisionCount: { increment: 1 },
        responseDueAt: null,
      },
    });
    await transaction.projectWorkflowEvent.create({
      data: {
        projectId,
        milestoneId,
        actorUserId,
        eventType: "MILESTONE_REVISION_REQUESTED",
        fromStatus: "AWAITING_ACCEPTANCE",
        toStatus: "NEEDS_REVISION",
        detailsJson: JSON.stringify({ revisionCount: milestone.revisionCount + 1 }),
        createdAt: now,
      },
    });
    await transaction.notification.createMany({
      data: getProjectTeamUserIds(project.team).map((userId) => ({
        userId,
        dedupeKey: `milestone-revision:${milestoneId}:${milestone.revisionCount + 1}:${userId}`,
        title: "Doanh nghiệp yêu cầu chỉnh sửa Milestone",
        message: `Milestone “${milestone.title}” cần được điều chỉnh trong phạm vi đã thỏa thuận.`,
        href: getProjectNotificationHref("STUDENT", projectId),
        createdAt: now,
      })),
    });
  });
}

export async function acceptPaidMilestone(
  database: WorkflowDatabase,
  {
    projectId,
    milestoneId,
    actorUserId,
    now = new Date(),
  }: {
    projectId: string;
    milestoneId: string;
    actorUserId: string;
    now?: Date;
  },
): Promise<{ alreadyAccepted: boolean; finalAcceptancePending: boolean }> {
  try {
    const projectBeforeTransaction = await database.project.findUnique({
      where: { id: projectId },
      select: { status: true },
    });
    if (!projectBeforeTransaction) throw new Error("Không tìm thấy dự án.");
    assertProjectActionable(projectBeforeTransaction);
    const existingBeforeTransaction = await database.projectTransaction.findUnique({
      where: { idempotencyKey: `release:${milestoneId}` },
      select: { id: true },
    });
    if (existingBeforeTransaction) {
      return { alreadyAccepted: true, finalAcceptancePending: false };
    }
    return await database.$transaction(async (transaction) => {
      const { milestone, project, escrow } = await getProjectForMilestoneAction(
        transaction,
        projectId,
        milestoneId,
      );
      if (project.application.problem.businessProfile.userId !== actorUserId) {
        throw new Error("Chỉ doanh nghiệp sở hữu dự án mới có thể nghiệm thu.");
      }
      assertProjectActionable(project);
      assertMilestoneMoneyActionable(milestone, project);
      if (milestone.acceptanceStatus !== "AWAITING_ACCEPTANCE") {
        throw new Error("Milestone chưa được nộp hoặc đã được xử lý.");
      }
      const deposit = await transaction.projectTransaction.findUniqueOrThrow({
        where: { id: escrow.id },
      });
      const orderedMilestones = project.milestones;
      const breakdown =
        deposit.businessFeeBasisPoints === null ||
        deposit.studentFeeBasisPoints === null
          ? calculateLegacyProjectFinancialBreakdown(
              project.totalAmount,
              orderedMilestones.map(({ paymentPercent }) => paymentPercent),
              legacyPlatformFeeRate,
            )
          : calculateProjectFinancialBreakdown(
              project.totalAmount,
              orderedMilestones.map(({ paymentPercent }) => paymentPercent),
              deposit.businessFeeBasisPoints,
              deposit.studentFeeBasisPoints,
            );
      const allocation = breakdown.milestones[milestone.sortOrder];
      if (!allocation) throw new Error("Không tính được phần tiền Milestone.");
      const releaseKey = `release:${milestoneId}`;
      await transitionPaidMilestone(transaction, {
        projectId,
        milestone: {
          id: milestone.id,
          status: milestone.status,
          acceptanceStatus: milestone.acceptanceStatus,
          paymentStatus: milestone.paymentStatus,
        },
        acceptanceStatus: "ACCEPTED",
        paymentStatus: "RELEASED",
        started: true,
        data: { acceptedAt: now, progressPercent: 100, responseDueAt: null },
      });
      await transaction.projectTransaction.create({
        data: {
          projectId,
          milestoneId,
          idempotencyKey: releaseKey,
          type: "MILESTONE_RELEASE",
          amount: allocation.teamAmount,
          platformFee:
            deposit.businessFeeBasisPoints === null ||
            deposit.studentFeeBasisPoints === null
              ? allocation.platformFee
              : allocation.studentFee,
          platformFeeBasisPoints:
            deposit.studentFeeBasisPoints ?? deposit.platformFeeBasisPoints,
          businessFeeBasisPoints: deposit.businessFeeBasisPoints,
          studentFeeBasisPoints: deposit.studentFeeBasisPoints,
          businessFee:
            deposit.businessFeeBasisPoints === null ? null : allocation.businessFee,
          status: "RELEASED",
          paidAt: now,
        },
      });
      const allAccepted = orderedMilestones.every(
        ({ id, acceptanceStatus, paymentStatus, status }) =>
          id === milestoneId ||
          acceptanceStatus === "ACCEPTED" ||
          (status === "CANCELLED" && paymentStatus === "REFUNDED"),
      );
      const recipients = getProjectTeamUserIds(project.team);
      if (allAccepted) {
        const escrowClosed = await transaction.projectTransaction.updateMany({
          where: { id: escrow.id, status: "ESCROW" },
          data: { status: "RELEASED" },
        });
        if (escrowClosed.count !== 1) throw new Error("Khoản escrow đã được xử lý.");
        const finalPending = await transaction.project.updateMany({
          where: {
            id: projectId,
            status: "IN_PROGRESS",
            finalAcceptanceStatus: { not: "ACCEPTED" },
          },
          data: { finalAcceptanceStatus: "AWAITING_FINAL_ACCEPTANCE" },
        });
        if (finalPending.count !== 1) throw new Error("Không thể mở nghiệm thu cuối cùng.");
        await transaction.projectWorkflowEvent.create({
          data: {
            projectId,
            milestoneId,
            actorUserId,
            eventType: "FINAL_ACCEPTANCE_REQUESTED",
            fromStatus: "IN_PROGRESS",
            toStatus: "AWAITING_FINAL_ACCEPTANCE",
            idempotencyKey: `final-acceptance-requested:${projectId}`,
            createdAt: now,
          },
        });
        await transaction.notification.createMany({
          data: [
            {
              userId: project.application.problem.businessProfile.userId,
              dedupeKey: `final-acceptance-requested:${projectId}:business`,
              title: "Dự án chờ nghiệm thu cuối cùng",
              message: `Tất cả Milestone của “${project.title}” đã được nghiệm thu. Vui lòng xác nhận hoàn tất dự án.`,
              href: getProjectNotificationHref("BUSINESS", projectId),
              createdAt: now,
            },
            ...recipients.map((userId) => ({
              userId,
              dedupeKey: `final-acceptance-requested:${projectId}:${userId}`,
              title: "Dự án chờ nghiệm thu cuối cùng",
              message: `Tất cả Milestone của “${project.title}” đã được nghiệm thu; đang chờ doanh nghiệp xác nhận cuối cùng.`,
              href: getProjectNotificationHref("STUDENT", projectId),
              createdAt: now,
            })),
          ],
        });
      } else {
        const nextMilestone = orderedMilestones.find(
          ({ sortOrder, acceptanceStatus, paymentStatus, status }) =>
            sortOrder > milestone.sortOrder &&
            acceptanceStatus !== "ACCEPTED" &&
            !(status === "CANCELLED" && paymentStatus === "REFUNDED") &&
            status !== "DISPUTED",
        );
        if (nextMilestone?.acceptanceStatus === "NOT_SUBMITTED") {
          await transitionPaidMilestone(transaction, {
            projectId,
            milestone: nextMilestone,
            acceptanceStatus: "NOT_SUBMITTED",
            paymentStatus: "ESCROW",
            started: nextMilestone.status === "IN_PROGRESS",
          });
        }
      }
      await transaction.projectWorkflowEvent.create({
        data: {
          projectId,
          milestoneId,
          actorUserId,
          eventType: "MILESTONE_ACCEPTED_AND_RELEASED",
          fromStatus: "AWAITING_ACCEPTANCE",
          toStatus: "ACCEPTED",
          detailsJson: JSON.stringify({
            releasedToTeam: allocation.teamAmount,
            platformFee: allocation.studentFee,
          }),
          idempotencyKey: releaseKey,
          createdAt: now,
        },
      });
      if (!allAccepted) {
        await transaction.notification.createMany({
          data: [
            {
              userId: project.application.problem.businessProfile.userId,
              dedupeKey: `milestone-accepted:${milestoneId}:business`,
              title: "Đã nghiệm thu Milestone",
              message: `Milestone “${milestone.title}” đã được nghiệm thu và ghi nhận giải ngân giả lập.`,
              href: getProjectNotificationHref("BUSINESS", projectId),
              createdAt: now,
            },
            ...recipients.map((userId) => ({
              userId,
              dedupeKey: `milestone-accepted:${milestoneId}:${userId}`,
              title: "Milestone được nghiệm thu",
              message: `Milestone “${milestone.title}” đã được nghiệm thu; Milestone tiếp theo đang mở.`,
              href: getProjectNotificationHref("STUDENT", projectId),
              createdAt: now,
            })),
          ],
        });
      }
      return { alreadyAccepted: false, finalAcceptancePending: allAccepted };
    });
  } catch (error) {
    const existing = await database.projectTransaction.findUnique({
      where: { idempotencyKey: `release:${milestoneId}` },
      select: { id: true },
    });
    if (existing) return { alreadyAccepted: true, finalAcceptancePending: false };
    throw error;
  }
}

export async function acceptLegacyMilestone(
  database: WorkflowDatabase,
  {
    projectId,
    milestoneId,
    now = new Date(),
  }: { projectId: string; milestoneId: string; now?: Date },
): Promise<{ alreadyAccepted: boolean }> {
  const releaseKey = `release:${milestoneId}`;
  const projectBeforeTransaction = await database.project.findUnique({
    where: { id: projectId },
    select: { status: true },
  });
  if (!projectBeforeTransaction) throw new Error("Không tìm thấy dự án.");
  assertProjectActionable(projectBeforeTransaction);
  const existingRelease = await database.projectTransaction.findUnique({
    where: { idempotencyKey: releaseKey },
    select: { id: true },
  });
  if (existingRelease) return { alreadyAccepted: true };

  try {
    await database.$transaction(async (transaction) => {
      const current = await transaction.project.findUnique({
        where: { id: projectId },
        include: {
          milestones: { orderBy: { sortOrder: "asc" } },
          transactions: { where: { type: "DEPOSIT", status: "ESCROW" } },
          team: {
            select: {
              ownerId: true,
              memberships: {
                select: { studentProfile: { select: { userId: true } } },
              },
            },
          },
          application: {
            include: {
              problem: {
                select: {
                  id: true,
                  title: true,
                  businessProfile: { select: { userId: true } },
                },
              },
            },
          },
        },
      });
      if (!current || !current.legacyTermsExempt || current.status !== "IN_PROGRESS") {
        throw new Error("Dự án hiện không thể nghiệm thu Milestone.");
      }
      const milestone = current.milestones.find(({ id }) => id === milestoneId);
      if (!milestone || milestone.status !== "SUBMITTED") {
        throw new Error("Milestone chưa được nộp hoặc đã được xử lý.");
      }
      if (
        current.milestones
          .filter(({ sortOrder }) => sortOrder < milestone.sortOrder)
          .some(({ status }) => status !== "ACCEPTED")
      ) {
        throw new Error("Cần nghiệm thu Milestone trước đó theo đúng thứ tự.");
      }
      const deposit = current.transactions[0];
      if (!deposit) throw new Error("Không tìm thấy khoản nạp escrow.");
      const usesLegacyFees =
        deposit.businessFeeBasisPoints === null ||
        deposit.studentFeeBasisPoints === null;
      const breakdown =
        deposit.businessFeeBasisPoints === null ||
        deposit.studentFeeBasisPoints === null
          ? calculateLegacyProjectFinancialBreakdown(
              current.totalAmount,
              current.milestones.map(({ paymentPercent }) => paymentPercent),
              legacyPlatformFeeRate,
            )
          : calculateProjectFinancialBreakdown(
              current.totalAmount,
              current.milestones.map(({ paymentPercent }) => paymentPercent),
              deposit.businessFeeBasisPoints,
              deposit.studentFeeBasisPoints,
            );
      const allocation = breakdown.milestones[milestone.sortOrder];
      if (!allocation) throw new Error("Không tính được phần tiền của Milestone.");
      const accepted = await transaction.milestone.updateMany({
        where: { id: milestoneId, projectId, status: "SUBMITTED" },
        data: { status: "ACCEPTED", acceptedAt: now },
      });
      if (accepted.count !== 1) throw new Error("Milestone đã được nghiệm thu trước đó.");
      await transaction.projectTransaction.create({
        data: {
          projectId,
          milestoneId,
          idempotencyKey: releaseKey,
          type: "MILESTONE_RELEASE",
          amount: allocation.teamAmount,
          platformFee: usesLegacyFees ? allocation.platformFee : allocation.studentFee,
          platformFeeBasisPoints: usesLegacyFees
            ? breakdown.platformFeeBasisPoints
            : deposit.studentFeeBasisPoints ?? studentFeeRate,
          businessFeeBasisPoints: usesLegacyFees
            ? null
            : deposit.businessFeeBasisPoints,
          studentFeeBasisPoints: usesLegacyFees
            ? null
            : deposit.studentFeeBasisPoints,
          businessFee: usesLegacyFees ? null : allocation.businessFee,
          status: "RELEASED",
          paidAt: now,
        },
      });
      const recipients = getProjectTeamUserIds(current.team);
      const allAccepted = current.milestones.every(
        ({ id, status }) => id === milestoneId || status === "ACCEPTED",
      );
      if (allAccepted) {
        const escrowClosed = await transaction.projectTransaction.updateMany({
          where: { id: deposit.id, type: "DEPOSIT", status: "ESCROW" },
          data: { status: "RELEASED" },
        });
        const completed = await transaction.project.updateMany({
          where: { id: projectId, status: "IN_PROGRESS" },
          data: { status: "COMPLETED", completedAt: now },
        });
        const problemCompleted = await transaction.problem.updateMany({
          where: {
            id: current.application.problem.id,
            status: "READY_FOR_IMPLEMENTATION",
          },
          data: { status: "COMPLETED" },
        });
        if (
          escrowClosed.count !== 1 ||
          completed.count !== 1 ||
          problemCompleted.count !== 1
        ) {
          throw new Error("Không thể hoàn tất đồng bộ dự án và bài toán.");
        }
        await transaction.notification.createMany({
          data: [
            {
              userId: current.application.problem.businessProfile.userId,
              title: "Dự án hoàn tất — hãy đánh giá đối tác",
              message: `Tất cả Milestone của dự án “${current.title}” đã được nghiệm thu. Hãy gửi đánh giá hợp tác trên UniBridge.`,
              href: getProjectNotificationHref("BUSINESS", projectId),
              createdAt: now,
            },
            ...recipients.map((userId) => ({
              userId,
              title: "Dự án hoàn tất — hãy đánh giá đối tác",
              message: `Tất cả Milestone của dự án “${current.title}” đã được nghiệm thu. Hãy gửi đánh giá hợp tác trên UniBridge.`,
              href: getProjectNotificationHref("STUDENT", projectId),
              createdAt: now,
            })),
          ],
        });
      } else {
        const nextMilestone = current.milestones.find(
          ({ sortOrder }) => sortOrder > milestone.sortOrder,
        );
        if (!nextMilestone) throw new Error("Thứ tự Milestone không hợp lệ.");
        const opened = await transaction.milestone.updateMany({
          where: { id: nextMilestone.id, status: "PENDING" },
          data: { status: "IN_PROGRESS" },
        });
        if (opened.count !== 1) throw new Error("Không thể mở Milestone kế tiếp.");
        await transaction.notification.createMany({
          data: [
            {
              userId: current.application.problem.businessProfile.userId,
              title: "Đã nghiệm thu Milestone",
              message: `Milestone “${milestone.title}” đã được nghiệm thu; đã ghi nhận phần giải ngân giả lập.`,
              href: getProjectNotificationHref("BUSINESS", projectId),
              createdAt: now,
            },
            ...recipients.map((userId) => ({
              userId,
              title: "Milestone được nghiệm thu",
              message: `Milestone “${milestone.title}” đã được nghiệm thu; Milestone tiếp theo đã mở.`,
              href: getProjectNotificationHref("STUDENT", projectId),
              createdAt: now,
            })),
          ],
        });
      }
    });
    return { alreadyAccepted: false };
  } catch (error) {
    const existing = await database.projectTransaction.findUnique({
      where: { idempotencyKey: releaseKey },
      select: { id: true },
    });
    if (existing) return { alreadyAccepted: true };
    throw error;
  }
}

export async function acceptProjectFinalCompletion(
  database: WorkflowDatabase,
  {
    projectId,
    actorUserId,
    now = new Date(),
  }: { projectId: string; actorUserId: string; now?: Date },
): Promise<{ alreadyCompleted: boolean }> {
  return database.$transaction(async (transaction) => {
    const project = await transaction.project.findUnique({
      where: { id: projectId },
      include: {
        milestones: true,
        team: {
          select: {
            ownerId: true,
            memberships: {
              select: { studentProfile: { select: { userId: true } } },
            },
          },
        },
        application: {
          include: {
            problem: {
              select: {
                id: true,
                title: true,
                status: true,
                businessProfile: { select: { userId: true } },
              },
            },
          },
        },
      },
    });
    if (!project || project.legacyTermsExempt) {
      throw new Error("Không tìm thấy dự án cần nghiệm thu cuối cùng.");
    }
    if (project.application.problem.businessProfile.userId !== actorUserId) {
      throw new Error("Chỉ doanh nghiệp sở hữu dự án mới có thể xác nhận nghiệm thu cuối cùng.");
    }
    if (project.status === "COMPLETED" && project.finalAcceptedAt) {
      return { alreadyCompleted: true };
    }
    assertProjectActionable(project);
    if (project.pausedAt) {
      throw new Error("Dự án đang tạm dừng; chưa thể nghiệm thu cuối cùng.");
    }
    if (
      project.status !== "IN_PROGRESS" ||
      project.finalAcceptanceStatus !== "AWAITING_FINAL_ACCEPTANCE" ||
      project.milestones.length === 0 ||
      project.milestones.some(
        ({ acceptanceStatus, paymentStatus, status }) =>
          !(
            (acceptanceStatus === "ACCEPTED" && paymentStatus === "RELEASED") ||
            (status === "CANCELLED" && paymentStatus === "REFUNDED")
          ),
      )
    ) {
      throw new Error("Dự án chưa đủ điều kiện nghiệm thu cuối cùng.");
    }
    const completed = await transaction.project.updateMany({
      where: {
        id: projectId,
        status: "IN_PROGRESS",
        finalAcceptanceStatus: "AWAITING_FINAL_ACCEPTANCE",
        finalAcceptedAt: null,
      },
      data: {
        status: "COMPLETED",
        finalAcceptanceStatus: "ACCEPTED",
        finalAcceptedAt: now,
        finalAcceptedById: actorUserId,
        completedAt: now,
      },
    });
    if (completed.count !== 1) throw new Error("Nghiệm thu cuối cùng đã được xử lý.");
    const problemCompleted = await transaction.problem.updateMany({
      where: {
        id: project.application.problem.id,
        status: "READY_FOR_IMPLEMENTATION",
      },
      data: { status: "COMPLETED" },
    });
    if (problemCompleted.count !== 1) {
      throw new Error("Không thể đồng bộ trạng thái bài toán.");
    }
    await transaction.projectWorkflowEvent.create({
      data: {
        projectId,
        actorUserId,
        eventType: "PROJECT_FINAL_ACCEPTED",
        fromStatus: "AWAITING_FINAL_ACCEPTANCE",
        toStatus: "COMPLETED",
        idempotencyKey: `project-final-accepted:${projectId}`,
        createdAt: now,
      },
    });
    const teamUserIds = getProjectTeamUserIds(project.team);
    await transaction.notification.createMany({
      data: [
        {
          userId: project.application.problem.businessProfile.userId,
          dedupeKey: `project-final-accepted:${projectId}:business`,
          title: "Dự án đã hoàn tất",
          message: `Bạn đã xác nhận hoàn tất dự án “${project.title}”.`,
          href: getProjectNotificationHref("BUSINESS", projectId),
          createdAt: now,
        },
        ...teamUserIds.map((userId) => ({
          userId,
          dedupeKey: `project-final-accepted:${projectId}:${userId}`,
          title: "Dự án đã hoàn tất",
          message: `Doanh nghiệp đã xác nhận hoàn tất dự án “${project.title}”.`,
          href: getProjectNotificationHref("STUDENT", projectId),
          createdAt: now,
        })),
      ],
    });
    return { alreadyCompleted: false };
  });
}

export type PaidMilestoneOverdue = {
  status: "OVERDUE" | "AWAITING_RESPONSE_OVERDUE" | null;
};

export function getPaidMilestoneOverdueStatus(
  milestone: {
    status: string;
    acceptanceStatus: string;
    dueAt: Date | null;
    responseDueAt: Date | null;
  },
  now: Date,
  pausedSeconds = 0,
): PaidMilestoneOverdue {
  if (milestone.status === "PAUSED" || milestone.status === "DISPUTED") {
    return { status: null };
  }
  const effectiveDueAt = milestone.dueAt
    ? new Date(milestone.dueAt.getTime() + pausedSeconds * 1000)
    : null;
  const effectiveResponseDueAt = milestone.responseDueAt
    ? new Date(milestone.responseDueAt.getTime() + pausedSeconds * 1000)
    : null;
  if (
    ["NOT_STARTED", "IN_PROGRESS", "NEEDS_REVISION"].includes(milestone.status) &&
    effectiveDueAt &&
    now.getTime() > effectiveDueAt.getTime()
  ) {
    return { status: "OVERDUE" };
  }
  if (
    milestone.acceptanceStatus === "AWAITING_ACCEPTANCE" &&
    effectiveResponseDueAt &&
    now.getTime() >= effectiveResponseDueAt.getTime()
  ) {
    return { status: "AWAITING_RESPONSE_OVERDUE" };
  }
  return { status: null };
}

type ReminderDatabase = Pick<PrismaClient, "project" | "notification">;
export type ProjectReminderClock = { now(): Date };

export async function ensurePaidMilestoneReminders(
  projectId: string,
  {
    database,
    clock = { now: () => new Date() },
  }: { database: ReminderDatabase; clock?: ProjectReminderClock },
): Promise<void> {
  const project = await database.project.findFirst({
    where: { id: projectId, legacyTermsExempt: false, status: "IN_PROGRESS" },
    include: {
      milestones: true,
      team: {
        select: {
          memberships: { select: { studentProfile: { select: { userId: true } } } },
          ownerId: true,
        },
      },
      application: {
        include: {
          problem: { select: { businessProfile: { select: { userId: true } } } },
        },
      },
    },
  });
  if (!project) return;
  const now = clock.now();
  const pausedSeconds =
    project.pausedTotalSeconds +
    (project.pausedAt
      ? Math.max(0, Math.floor((now.getTime() - project.pausedAt.getTime()) / 1000))
      : 0);
  const teamUserIds = getProjectTeamUserIds(project.team);
  for (const milestone of project.milestones) {
    const overdue = getPaidMilestoneOverdueStatus(milestone, now, pausedSeconds).status;
    if (!overdue) continue;
    const isResponseOverdue = overdue === "AWAITING_RESPONSE_OVERDUE";
    const recipients = isResponseOverdue
      ? [project.application.problem.businessProfile.userId]
      : teamUserIds;
    for (const userId of recipients) {
      const notification = {
        userId,
        dedupeKey: `paid-milestone-overdue:${milestone.id}:${overdue}:${userId}`,
        title: isResponseOverdue
          ? "Milestone chờ xử lý quá hạn phản hồi"
          : "Milestone quá hạn",
        message: isResponseOverdue
          ? `Milestone “${milestone.title}” của dự án “${project.title}” đang chờ doanh nghiệp phản hồi.`
          : `Milestone “${milestone.title}” của dự án “${project.title}” đã quá hạn nộp.`,
        href: getProjectNotificationHref(isResponseOverdue ? "BUSINESS" : "STUDENT", projectId),
        createdAt: now,
      };
      try {
        await database.notification.create({ data: notification });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          continue;
        }
        console.error("Không thể tạo thông báo nhắc Milestone:", error);
      }
    }
  }
}
