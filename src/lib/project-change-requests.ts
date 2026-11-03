import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { writeAuditLog } from "@/lib/audit-log";
import { canRespondForTeam } from "@/lib/team-permissions";
import {
  projectReminderConfig,
  projectReminderHourMs,
  refundableBusinessFeeBasisPoints,
} from "@/lib/project-reminder-config";
import { getAcceptedProjectAgreementSnapshot } from "@/lib/project-agreements";
import { calculateProjectFinancialBreakdown } from "@/lib/project-money";
import {
  assertProjectActionable,
  derivePaidMilestoneStatus,
} from "@/lib/project-milestone-workflow";
import { getProjectNotificationHref } from "@/lib/project-notification-links";

export type ProjectChangeKind =
  | "EXTENSION"
  | "PAUSE"
  | "RESUME"
  | "MILESTONE_CANCEL"
  | "DISPUTE"
  | "DISPUTE_RESOLUTION"
  | "PROJECT_TERMINATION";

export type ProjectChangeRequestResponse = "ACCEPT" | "REJECT";

export type ProjectChangeRequestPayload = {
  dueAt?: string;
  days?: number;
  reason?: string;
  note?: string;
  milestoneTitle?: string;
};

export type ProjectChangeRequestDatabase = Pick<PrismaClient, "$transaction" | "projectChangeRequest" | "project" | "milestone" | "projectTransaction" | "projectAgreementVersion" | "projectWorkflowEvent" | "notification" | "projectSupportNote">;

export function getProjectChangeReminderHours(): number {
  return projectReminderConfig.pendingChangeRequestResponseHours ?? 72;
}

export function getEffectiveProjectPauseSeconds(
  pausedAt: Date | null,
  pausedTotalSeconds: number,
  now = new Date(),
) {
  if (!pausedAt) return pausedTotalSeconds;
  return pausedTotalSeconds + Math.max(0, Math.floor((now.getTime() - pausedAt.getTime()) / 1000));
}

export function getEffectiveProjectDueAt(
  dueAt: Date,
  pausedAt: Date | null,
  pausedTotalSeconds: number,
  now = new Date(),
) {
  return new Date(
    dueAt.getTime() + getEffectiveProjectPauseSeconds(pausedAt, pausedTotalSeconds, now) * 1000,
  );
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function deriveRestoredMilestoneStatus(milestone: {
  acceptanceStatus: string;
  paymentStatus: string;
  started: boolean;
}) {
  return derivePaidMilestoneStatus(
    milestone.acceptanceStatus,
    milestone.paymentStatus,
    milestone.started,
  );
}

async function getUnreleasedRefundableAmount(
  transaction: Prisma.TransactionClient,
  projectId: string,
): Promise<number> {
  const project = await transaction.project.findUnique({
    where: { id: projectId },
    include: { milestones: { orderBy: { sortOrder: "asc" } } },
  });
  if (!project || project.legacyTermsExempt) {
    throw new Error("Chỉ dự án Paid Implementation mới được chấm dứt bằng yêu cầu thay đổi.");
  }
  assertProjectActionable(project);
  const escrowMilestones = project.milestones.filter(
    ({ paymentStatus }) => paymentStatus === "ESCROW",
  );
  if (escrowMilestones.length === 0) return 0;
  const deposit = await transaction.projectTransaction.findFirst({
    where: { projectId, type: "DEPOSIT", paidAt: { not: null } },
  });
  if (
    !deposit ||
    deposit.businessFeeBasisPoints === null ||
    deposit.studentFeeBasisPoints === null
  ) {
    throw new Error("Không tìm thấy giao dịch nạp theo thỏa thuận đã ký.");
  }
  const snapshot = await getAcceptedProjectAgreementSnapshot(transaction, projectId);
  if (snapshot.milestones.length !== project.milestones.length) {
    throw new Error("Danh sách Milestone không khớp snapshot đã ký.");
  }
  const breakdown = calculateProjectFinancialBreakdown(
    snapshot.totalAmount,
    snapshot.milestones.map(({ paymentPercent }) => paymentPercent),
    deposit.businessFeeBasisPoints,
    deposit.studentFeeBasisPoints,
  );
  if (breakdown.totalDeposit !== deposit.amount) {
    throw new Error("Số tiền nạp không khớp snapshot đã ký.");
  }
  return escrowMilestones.reduce((sum, milestone) => {
    const allocation = breakdown.milestones[milestone.sortOrder];
    if (!allocation) throw new Error("Không tính được giá trị mốc còn trong escrow.");
    return sum + allocation.grossAmount;
  }, 0);
}

export async function createProjectChangeRequest(
  database: ProjectChangeRequestDatabase,
  {
    projectId,
    kind,
    actorUserId,
    reason,
    milestoneId,
    payload,
    proposedDueAt,
    idempotencyKey,
    actorRole,
    now = new Date(),
  }: {
    projectId: string;
    kind: ProjectChangeKind;
    actorUserId: string;
    reason: string;
    milestoneId?: string | null;
    payload?: ProjectChangeRequestPayload;
    proposedDueAt?: Date | null;
    idempotencyKey?: string;
    actorRole?: string;
    now?: Date;
  },
) {
  const validKinds: ProjectChangeKind[] = [
    "EXTENSION",
    "PAUSE",
    "RESUME",
    "MILESTONE_CANCEL",
    "DISPUTE",
    "DISPUTE_RESOLUTION",
    "PROJECT_TERMINATION",
  ];
  if (!validKinds.includes(kind)) {
    throw new Error("Loại yêu cầu không hợp lệ.");
  }
  if (!reason.trim()) throw new Error("Lý do yêu cầu không được để trống.");
  if (idempotencyKey && !idempotencyKey.trim()) throw new Error("Idempotency key không hợp lệ.");
  if (actorRole === "ADMIN") throw new Error("Admin chỉ được đọc và ghi chú hỗ trợ.");
  const normalizedPayload: ProjectChangeRequestPayload = {
    ...payload,
    ...(kind === "EXTENSION" && proposedDueAt
      ? { dueAt: proposedDueAt.toISOString() }
      : {}),
  };
  if (kind === "PAUSE") {
    const pauseDays = normalizedPayload.days ?? projectReminderConfig.pauseMaxDays;
    if (
      !Number.isInteger(pauseDays) ||
      pauseDays <= 0 ||
      pauseDays > projectReminderConfig.pauseMaxDays
    ) {
      throw new Error(`Tạm dừng tối đa ${projectReminderConfig.pauseMaxDays} ngày mỗi lần.`);
    }
    normalizedPayload.days = pauseDays;
  }

  const requestKey =
    idempotencyKey ??
    `project-change:${projectId}:${kind}:${milestoneId ?? "project"}:${actorUserId}:${now.toISOString()}`;
  try {
    return await database.$transaction(async (transaction) => {
    const project = await transaction.project.findUnique({
      where: { id: projectId },
      include: {
        team: { select: { ownerId: true } },
        application: {
          select: {
            problem: { select: { businessProfile: { select: { userId: true } } } },
          },
        },
      },
    });
    if (!project || project.legacyTermsExempt) {
      throw new Error("Chỉ dự án mới được xử lý bằng yêu cầu thay đổi.");
    }
    assertProjectActionable(project);
    const businessUserId = project.application.problem.businessProfile.userId;
    const isBusiness = businessUserId === actorUserId;
    const isTeamOwner = canRespondForTeam(project.team.ownerId, actorUserId);
    if (!isBusiness && !isTeamOwner) {
      throw new Error("Bạn không có quyền đề xuất thay đổi cho dự án.");
    }
    const existingRequest = await transaction.projectChangeRequest.findUnique({
      where: { idempotencyKey: requestKey },
    });
    if (existingRequest) {
      if (
        existingRequest.projectId !== projectId ||
        existingRequest.kind !== kind ||
        existingRequest.requestedByUserId !== actorUserId
      ) {
        throw new Error("Idempotency key đã được dùng cho yêu cầu khác.");
      }
      return existingRequest;
    }
    if (project.status !== "IN_PROGRESS") {
      throw new Error("Dự án hiện không ở trạng thái đang thực hiện.");
    }
    if (project.pausedAt && kind !== "RESUME" && kind !== "PROJECT_TERMINATION") {
      throw new Error("Dự án đang tạm dừng; chỉ có thể tiếp tục hoặc đề nghị chấm dứt.");
    }
    if (kind === "PAUSE" && project.pausedAt) {
      throw new Error("Dự án đã tạm dừng.");
    }
    if (kind === "RESUME" && !project.pausedAt) {
      throw new Error("Dự án hiện không tạm dừng.");
    }
    if (
      (kind === "EXTENSION" || kind === "DISPUTE" || kind === "DISPUTE_RESOLUTION" || kind === "MILESTONE_CANCEL") &&
      !milestoneId
    ) {
      throw new Error("Yêu cầu này cần gắn với một Milestone.");
    }
    if (milestoneId) {
      const milestone = await transaction.milestone.findUnique({
        where: { id: milestoneId },
        select: {
          projectId: true,
          status: true,
          acceptanceStatus: true,
          paymentStatus: true,
          dueAt: true,
          progressPercent: true,
        },
      });
      if (!milestone || milestone.projectId !== projectId) {
        throw new Error("Milestone không thuộc dự án hiện tại.");
      }
      if (kind === "EXTENSION" && ["ACCEPTED", "DISPUTED", "CANCELLED"].includes(milestone.status)) {
        throw new Error("Milestone đã hoàn tất hoặc đang bất đồng không thể gia hạn.");
      }
      if (kind === "MILESTONE_CANCEL" && milestone.acceptanceStatus === "ACCEPTED") {
        throw new Error("Milestone đã nghiệm thu không thể hủy.");
      }
      if (kind === "MILESTONE_CANCEL" && milestone.paymentStatus !== "ESCROW") {
        throw new Error("Chỉ có thể hủy Milestone còn tiền trong escrow.");
      }
      if (kind === "DISPUTE" && milestone.status === "DISPUTED") {
        throw new Error("Milestone này đã đang trong trạng thái bất đồng.");
      }
      if (kind === "DISPUTE_RESOLUTION" && milestone.status !== "DISPUTED") {
        throw new Error("Milestone không có bất đồng đang chờ xử lý.");
      }
      if (kind === "EXTENSION") {
        const dueAt = proposedDueAt ?? (payload?.dueAt ? new Date(payload.dueAt) : null);
        const duration = dueAt && milestone.dueAt ? dueAt.getTime() - milestone.dueAt.getTime() : 0;
        if (!dueAt || !Number.isFinite(dueAt.getTime()) || duration <= 0) {
          throw new Error("Hạn gia hạn mới phải sau hạn hiện tại.");
        }
        if (duration > projectReminderConfig.extensionMaxDays * 24 * projectReminderHourMs) {
          throw new Error(`Gia hạn tối đa ${projectReminderConfig.extensionMaxDays} ngày mỗi lần.`);
        }
      }
    }
    if (milestoneId) {
      const openSameKind = await transaction.projectChangeRequest.findFirst({
        where: { projectId, milestoneId, kind, status: "OPEN" },
      });
      if (openSameKind) throw new Error("Đã có yêu cầu cùng loại đang chờ xử lý.");
    }
    if (kind === "PAUSE" || kind === "RESUME") {
      const openKind = await transaction.projectChangeRequest.findFirst({
        where: { projectId, kind, status: "OPEN" },
      });
      if (openKind) throw new Error("Đã có yêu cầu tạm dừng/tiếp tục đang chờ xử lý.");
    }
    if (kind === "PROJECT_TERMINATION") {
      if (await getUnreleasedRefundableAmount(transaction, projectId) <= 0) {
        throw new Error("Không còn mốc chưa giải ngân.");
      }
      const openTermination = await transaction.projectChangeRequest.findFirst({
        where: { projectId, kind, status: "OPEN" },
      });
      if (openTermination) throw new Error("Đã có yêu cầu chấm dứt dự án đang chờ xác nhận.");
    }
    if (kind === "DISPUTE_RESOLUTION" && milestoneId) {
      const openResolution = await transaction.projectChangeRequest.findFirst({
        where: { projectId, milestoneId, kind, status: "OPEN" },
      });
      if (openResolution) throw new Error("Đã có yêu cầu đóng bất đồng đang chờ xác nhận.");
    }
    const request = await transaction.projectChangeRequest.create({
      data: {
        projectId,
        milestoneId: milestoneId ?? null,
        kind,
        status: "OPEN",
        reason,
        payloadJson: JSON.stringify(normalizedPayload),
        proposedDueAt: proposedDueAt ?? null,
        requestedByUserId: actorUserId,
        idempotencyKey: requestKey,
        createdAt: now,
      },
    });
    if (kind === "DISPUTE" && milestoneId) {
      const milestone = await transaction.milestone.findUniqueOrThrow({
        where: { id: milestoneId },
      });
      const latestSubmission = await transaction.milestoneSubmission.findFirst({
        where: { milestoneId },
        orderBy: { createdAt: "desc" },
        select: { id: true, note: true, links: true, createdAt: true },
      });
      await transaction.projectChangeRequest.update({
        where: { id: request.id },
        data: {
          payloadJson: JSON.stringify({
            ...normalizedPayload,
            previousStatus: milestone.status,
            latestSubmission: latestSubmission
              ? {
                  id: latestSubmission.id,
                  note: latestSubmission.note,
                  links: latestSubmission.links,
                  createdAt: latestSubmission.createdAt.toISOString(),
                }
              : null,
          }),
        },
      });
      const changed = await transaction.milestone.updateMany({
        where: {
          id: milestoneId,
          projectId,
          status: milestone.status,
          acceptanceStatus: milestone.acceptanceStatus,
          paymentStatus: milestone.paymentStatus,
        },
        data: { status: "DISPUTED" },
      });
      if (changed.count !== 1) throw new Error("Milestone đã thay đổi. Vui lòng tải lại.");
      await transaction.projectWorkflowEvent.create({
        data: {
          projectId,
          milestoneId,
          actorUserId,
          eventType: "MILESTONE_DISPUTE_OPENED",
          fromStatus: milestone.status,
          toStatus: "DISPUTED",
          detailsJson: JSON.stringify({
            requestId: request.id,
            submissionId: latestSubmission?.id ?? null,
            reason,
          }),
          idempotencyKey: `project-dispute-opened:${request.id}`,
          createdAt: now,
        },
      });
    }
    await transaction.projectWorkflowEvent.create({
      data: {
        projectId,
        milestoneId: milestoneId ?? null,
        actorUserId,
        eventType: `PROJECT_CHANGE_REQUESTED_${kind}`,
        fromStatus: project.status,
        toStatus: "OPEN",
        detailsJson: JSON.stringify({ requestId: request.id, kind, milestoneId, payload: normalizedPayload }),
        idempotencyKey: `project-change-requested:${request.id}`,
        createdAt: now,
      },
    });
    const otherUserId = isBusiness
      ? project.team.ownerId
      : project.application.problem.businessProfile.userId;
    if (otherUserId) {
      await transaction.notification.create({
        data: {
          userId: otherUserId,
          dedupeKey: `project-change:${request.id}:${otherUserId}`,
          title: "Yêu cầu thay đổi dự án",
          message: `Có một yêu cầu ${kind} đang chờ xác nhận.`,
          href: getProjectNotificationHref(isBusiness ? "STUDENT" : "BUSINESS", projectId),
          createdAt: now,
        },
      });
    }
    return request;
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const existing = await database.projectChangeRequest.findUnique({
        where: { idempotencyKey: requestKey },
      });
      if (
        existing?.projectId === projectId &&
        existing.kind === kind &&
        existing.requestedByUserId === actorUserId
      ) {
        return existing;
      }
    }
    throw error;
  }
}

export async function refundUnreleasedMilestones(
  transaction: Prisma.TransactionClient,
  projectId: string,
  milestoneIds: string[],
  idempotencyKey: string,
  actorUserId: string | null = null,
  now = new Date(),
): Promise<number> {
  if (!idempotencyKey.trim()) throw new Error("Idempotency key hoàn tiền không hợp lệ.");
  if (milestoneIds.length === 0 || new Set(milestoneIds).size !== milestoneIds.length) {
    throw new Error("Danh sách Milestone hoàn tiền không hợp lệ.");
  }
  const project = await transaction.project.findUnique({
    where: { id: projectId },
    include: { milestones: { orderBy: { sortOrder: "asc" } } },
  });
  if (!project || project.legacyTermsExempt) {
    throw new Error("Chỉ dự án Paid Implementation mới được hoàn tiền.");
  }
  assertProjectActionable(project);
  const deposit = await transaction.projectTransaction.findFirst({
    where: { projectId, type: "DEPOSIT", paidAt: { not: null } },
  });
  if (!deposit || deposit.businessFeeBasisPoints === null || deposit.studentFeeBasisPoints === null) {
    throw new Error("Không tìm thấy giao dịch nạp theo thỏa thuận đã ký.");
  }
  const snapshot = await getAcceptedProjectAgreementSnapshot(transaction, projectId);
  if (snapshot.milestones.length !== project.milestones.length) {
    throw new Error("Danh sách Milestone không khớp snapshot đã ký; không thể hoàn tiền.");
  }
  const breakdown = calculateProjectFinancialBreakdown(
    snapshot.totalAmount,
    snapshot.milestones.map(({ paymentPercent }) => paymentPercent),
    deposit.businessFeeBasisPoints,
    deposit.studentFeeBasisPoints,
  );
  if (breakdown.totalDeposit !== deposit.amount) {
    throw new Error("Số tiền nạp không khớp snapshot; không thể hoàn tiền.");
  }

  const requestedIds = new Set(milestoneIds);
  if ([...requestedIds].some((id) => !project.milestones.some((milestone) => milestone.id === id))) {
    throw new Error("Milestone hoàn tiền không thuộc dự án.");
  }
  let totalRefunded = 0;
  for (const [index, milestone] of project.milestones.entries()) {
    if (!requestedIds.has(milestone.id)) continue;
    if (milestone.paymentStatus === "REFUNDED") {
      const priorRefund = await transaction.projectTransaction.findUnique({
        where: { idempotencyKey: `${idempotencyKey}:${milestone.id}` },
        select: { projectId: true, milestoneId: true, type: true, amount: true },
      });
      if (
        priorRefund?.projectId !== projectId ||
        priorRefund.milestoneId !== milestone.id ||
        priorRefund.type !== "REFUND"
      ) {
        throw new Error("Milestone đã được hoàn bằng yêu cầu khác.");
      }
      totalRefunded += priorRefund.amount;
      continue;
    }
    if (milestone.paymentStatus !== "ESCROW") {
      throw new Error("Milestone không còn tiền trong escrow để hoàn.");
    }
    const allocation = breakdown.milestones[index];
    if (!allocation || allocation.grossAmount <= 0) {
      throw new Error("Không xác định được số tiền hoàn theo snapshot.");
    }
    const existingRelease = await transaction.projectTransaction.findFirst({
      where: { projectId, milestoneId: milestone.id, type: "MILESTONE_RELEASE" },
      select: { id: true },
    });
    if (existingRelease) {
      throw new Error("Milestone có giao dịch giải ngân nhưng vẫn đang ở trạng thái escrow.");
    }
    const existingRefund = await transaction.projectTransaction.findFirst({
      where: { projectId, milestoneId: milestone.id, type: "REFUND" },
      select: { id: true },
    });
    if (existingRefund) {
      throw new Error("Milestone đã có giao dịch hoàn tiền.");
    }
    await transaction.projectTransaction.create({
      data: {
        projectId,
        milestoneId: milestone.id,
        idempotencyKey: `${idempotencyKey}:${milestone.id}`,
        type: "REFUND",
        amount: allocation.grossAmount,
        platformFee: 0,
        platformFeeBasisPoints: 0,
        businessFeeBasisPoints: refundableBusinessFeeBasisPoints,
        studentFeeBasisPoints: 0,
        businessFee: 0,
        status: "REFUNDED",
        paidAt: now,
      },
    });
    const changed = await transaction.milestone.updateMany({
      where: {
        id: milestone.id,
        projectId,
        status: milestone.status,
        acceptanceStatus: milestone.acceptanceStatus,
        paymentStatus: "ESCROW",
      },
      data: {
        status: "CANCELLED",
        acceptanceStatus: "NOT_SUBMITTED",
        paymentStatus: "REFUNDED",
        responseDueAt: null,
        pausedAt: null,
      },
    });
    if (changed.count !== 1) throw new Error("Milestone đã thay đổi trước khi hoàn tiền.");
    await transaction.projectWorkflowEvent.create({
      data: {
        projectId,
        milestoneId: milestone.id,
        actorUserId,
        eventType: "MILESTONE_ESCROW_REFUNDED",
        fromStatus: milestone.status,
        toStatus: "CANCELLED",
        detailsJson: JSON.stringify({ amount: allocation.grossAmount, idempotencyKey }),
        idempotencyKey: `milestone-refund:${idempotencyKey}:${milestone.id}`,
        createdAt: now,
      },
    });
    totalRefunded += allocation.grossAmount;
  }
  if (!Number.isSafeInteger(totalRefunded)) throw new Error("Tổng tiền hoàn vượt giới hạn an toàn.");
  const [releases, refunds, escrowMilestones] = await Promise.all([
    transaction.projectTransaction.findMany({
      where: { projectId, type: "MILESTONE_RELEASE" },
      select: { amount: true, platformFee: true },
    }),
    transaction.projectTransaction.findMany({
      where: { projectId, type: "REFUND" },
      select: { amount: true },
    }),
    transaction.milestone.findMany({
      where: { projectId, paymentStatus: "ESCROW" },
      select: { sortOrder: true },
    }),
  ]);
  const remainingEscrow = escrowMilestones.reduce((sum, milestone) => {
    const allocation = breakdown.milestones[milestone.sortOrder];
    if (!allocation) throw new Error("Không tính được escrow còn lại theo snapshot.");
    return sum + allocation.grossAmount;
  }, 0);
  const ledgerTotal =
    (deposit.businessFee ?? 0) +
    releases.reduce((sum, release) => sum + release.amount + release.platformFee, 0) +
    remainingEscrow +
    refunds.reduce((sum, refund) => sum + refund.amount, 0);
  if (ledgerTotal !== deposit.amount) {
    throw new Error("Bất biến tiền dự án không hợp lệ sau khi hoàn tiền.");
  }
  return totalRefunded;
}

async function settleEscrowIfAllMilestonesResolved(
  transaction: Prisma.TransactionClient,
  projectId: string,
): Promise<void> {
  const project = await transaction.project.findUnique({
    where: { id: projectId },
    include: { milestones: true },
  });
  if (!project) throw new Error("Không tìm thấy dự án.");
  const allResolved = project.milestones.length > 0 && project.milestones.every(
    ({ acceptanceStatus, paymentStatus, status }) =>
      (acceptanceStatus === "ACCEPTED" && paymentStatus === "RELEASED") ||
      (status === "CANCELLED" && paymentStatus === "REFUNDED"),
  );
  if (!allResolved) return;
  const escrowDeposit = await transaction.projectTransaction.findFirst({
    where: { projectId, type: "DEPOSIT", status: "ESCROW" },
    select: { id: true },
  });
  if (escrowDeposit) {
    const settled = await transaction.projectTransaction.updateMany({
      where: { id: escrowDeposit.id, projectId, type: "DEPOSIT", status: "ESCROW" },
      data: { status: "SETTLED" },
    });
    if (settled.count !== 1) throw new Error("Khoản escrow đã được xử lý.");
  }
  if (project.status === "IN_PROGRESS") {
    const changed = await transaction.project.updateMany({
      where: {
        id: projectId,
        status: "IN_PROGRESS",
        finalAcceptanceStatus: { not: "ACCEPTED" },
      },
      data: { finalAcceptanceStatus: "AWAITING_FINAL_ACCEPTANCE" },
    });
    if (changed.count !== 1) throw new Error("Không thể mở nghiệm thu cuối cùng.");
  }
}

export async function respondToProjectChangeRequest(
  database: ProjectChangeRequestDatabase,
  {
    requestId,
    actorUserId,
    response,
    actorRole,
    now = new Date(),
  }: {
    requestId: string;
    actorUserId: string;
    response: ProjectChangeRequestResponse;
    actorRole?: string;
    now?: Date;
  },
) {
  if (actorRole === "ADMIN") throw new Error("Admin chỉ được đọc và ghi chú hỗ trợ.");
  return database.$transaction(async (transaction) => {
    const request = await transaction.projectChangeRequest.findUnique({
      where: { id: requestId },
      include: {
        project: {
          select: {
            id: true,
            status: true,
            title: true,
            pausedAt: true,
            pausedTotalSeconds: true,
            team: { select: { ownerId: true } },
            application: {
              select: {
                problem: { select: { businessProfile: { select: { userId: true } } } },
              },
            },
          },
        },
        milestone: {
          select: {
            id: true,
            title: true,
            dueAt: true,
            status: true,
            acceptanceStatus: true,
            paymentStatus: true,
            progressPercent: true,
          },
        },
      },
    });
    if (!request) throw new Error("Không tìm thấy yêu cầu thay đổi.");
    const businessUserId = request.project.application.problem.businessProfile.userId;
    const isBusiness = businessUserId === actorUserId;
    const isTeamOwner = canRespondForTeam(request.project.team.ownerId, actorUserId);
    if (!isBusiness && !isTeamOwner) {
      throw new Error("Bạn không có quyền xác nhận yêu cầu này.");
    }
    if (request.status === "ACCEPTED") {
      return { status: "ACCEPTED", alreadyAccepted: true };
    }
    assertProjectActionable(request.project);
    if (request.status !== "OPEN") throw new Error("Yêu cầu này không còn ở trạng thái chờ xử lý.");
    if (request.kind === "DISPUTE") {
      throw new Error("Bất đồng được mở ngay; hãy tạo yêu cầu DISPUTE_RESOLUTION để đóng bằng hai xác nhận.");
    }

    if (response === "REJECT") {
      const rejected = await transaction.projectChangeRequest.updateMany({
        where: { id: requestId, status: "OPEN" },
        data: { status: "REJECTED", resolvedAt: now },
      });
      if (rejected.count !== 1) throw new Error("Yêu cầu đã được xử lý. Vui lòng tải lại.");
      await transaction.projectWorkflowEvent.create({
        data: {
          projectId: request.projectId,
          milestoneId: request.milestoneId,
          actorUserId,
          eventType: `PROJECT_CHANGE_REJECTED_${request.kind}`,
          fromStatus: "OPEN",
          toStatus: "REJECTED",
          detailsJson: JSON.stringify({ requestId }),
          idempotencyKey: `project-change-rejected:${requestId}`,
          createdAt: now,
        },
      });
      const otherUserId = isBusiness
        ? request.project.team.ownerId
        : businessUserId;
      if (otherUserId) {
        try {
          await transaction.notification.create({
            data: {
              userId: otherUserId,
              dedupeKey: `project-change-response:${requestId}:${actorUserId}`,
              title: "Yêu cầu thay đổi đã bị từ chối",
              message: `Yêu cầu ${request.kind} của dự án “${request.project.title}” đã bị từ chối.`,
              href: getProjectNotificationHref(isBusiness ? "STUDENT" : "BUSINESS", request.projectId),
              createdAt: now,
            },
          });
        } catch (error) {
          if (!isUniqueConstraintError(error)) throw error;
        }
      }
      return { status: "REJECTED" };
    }

    const approvalUpdated = await transaction.projectChangeRequest.updateMany({
      where: {
        id: requestId,
        status: "OPEN",
        ...(isBusiness ? { businessAcceptedAt: null } : { teamAcceptedAt: null }),
      },
      data: isBusiness ? { businessAcceptedAt: now } : { teamAcceptedAt: now },
    });
    if (approvalUpdated.count !== 1) throw new Error("Bạn đã xác nhận yêu cầu này. Vui lòng tải lại.");
    const updated = await transaction.projectChangeRequest.findUniqueOrThrow({
      where: { id: requestId },
    });
    const otherUserId = isBusiness
      ? request.project.team.ownerId
      : businessUserId;
    if (otherUserId) {
      try {
        await transaction.notification.create({
          data: {
            userId: otherUserId,
            dedupeKey: `project-change-response:${requestId}:${actorUserId}`,
            title: "Yêu cầu thay đổi đã được xác nhận",
            message: `Một bên đã xác nhận yêu cầu ${request.kind} của dự án “${request.project.title}”.`,
            href: getProjectNotificationHref(isBusiness ? "STUDENT" : "BUSINESS", request.projectId),
            createdAt: now,
          },
        });
      } catch (error) {
        if (!isUniqueConstraintError(error)) throw error;
      }
    }

    const acceptedByBoth =
      updated.businessAcceptedAt !== null && updated.teamAcceptedAt !== null;
    if (!acceptedByBoth) {
      return { status: "OPEN" };
    }
    if (
      request.kind === "PROJECT_TERMINATION" &&
      await getUnreleasedRefundableAmount(transaction, request.projectId) <= 0
    ) {
      const reason = `${request.reason}\n\nKhông còn mốc chưa giải ngân.`;
      const rejected = await transaction.projectChangeRequest.updateMany({
        where: {
          id: requestId,
          status: "OPEN",
          businessAcceptedAt: { not: null },
          teamAcceptedAt: { not: null },
        },
        data: { status: "REJECTED", reason, resolvedAt: now },
      });
      if (rejected.count !== 1) throw new Error("Yêu cầu đã thay đổi. Vui lòng tải lại.");
      await transaction.projectWorkflowEvent.create({
        data: {
          projectId: request.projectId,
          actorUserId,
          eventType: "PROJECT_CHANGE_REJECTED_PROJECT_TERMINATION",
          fromStatus: "OPEN",
          toStatus: "REJECTED",
          detailsJson: JSON.stringify({ requestId, reason: "Không còn mốc chưa giải ngân" }),
          idempotencyKey: `project-termination-no-refund:${requestId}`,
          createdAt: now,
        },
      });
      return { status: "REJECTED", reason: "Không còn mốc chưa giải ngân." };
    }

    const resolved = await transaction.projectChangeRequest.updateMany({
      where: {
        id: requestId,
        status: "OPEN",
        businessAcceptedAt: { not: null },
        teamAcceptedAt: { not: null },
      },
      data: { status: "ACCEPTED", resolvedAt: now },
    });
    if (resolved.count !== 1) throw new Error("Yêu cầu đã được xử lý. Vui lòng tải lại.");

    const payload = JSON.parse(request.payloadJson || "{}") as ProjectChangeRequestPayload;
    switch (request.kind) {
      case "EXTENSION": {
        if (!request.milestoneId || !request.milestone || !payload.dueAt) {
          throw new Error("Yêu cầu gia hạn thiếu dữ liệu.");
        }
        const newDueAt = new Date(payload.dueAt);
        const previous = request.milestone?.dueAt ? new Date(request.milestone.dueAt) : null;
        const duration = previous ? newDueAt.getTime() - previous.getTime() : 0;
        if (
          !previous ||
          !Number.isFinite(newDueAt.getTime()) ||
          duration <= 0 ||
          duration > projectReminderConfig.extensionMaxDays * 24 * projectReminderHourMs
        ) {
          throw new Error(`Gia hạn tối đa ${projectReminderConfig.extensionMaxDays} ngày mỗi lần.`);
        }
        const changed = await transaction.milestone.updateMany({
          where: {
            id: request.milestoneId,
            projectId: request.projectId,
            status: request.milestone.status,
            acceptanceStatus: { not: "ACCEPTED" },
            dueAt: previous,
          },
          data: { dueAt: newDueAt },
        });
        if (changed.count !== 1) throw new Error("Milestone đã thay đổi. Vui lòng tải lại.");
        break;
      }
      case "PAUSE": {
        const pauseDays = payload.days ?? projectReminderConfig.pauseMaxDays;
        if (
          !Number.isInteger(pauseDays) ||
          pauseDays <= 0 ||
          pauseDays > projectReminderConfig.pauseMaxDays
        ) {
          throw new Error(`Tạm dừng tối đa ${projectReminderConfig.pauseMaxDays} ngày mỗi lần.`);
        }
        const changed = await transaction.project.updateMany({
          where: { id: request.projectId, status: "IN_PROGRESS", pausedAt: null },
          data: { pausedAt: now },
        });
        if (changed.count !== 1) throw new Error("Dự án đã tạm dừng hoặc thay đổi trạng thái.");
        const activeMilestones = await transaction.milestone.findMany({
          where: {
            projectId: request.projectId,
            paymentStatus: "ESCROW",
            pausedAt: null,
            status: { not: "CANCELLED" },
          },
          orderBy: { sortOrder: "asc" },
          select: { id: true, status: true },
        });
        const pausedMilestones: { id: string; previousStatus: string }[] = [];
        for (const milestone of activeMilestones) {
          const nextStatus = milestone.status === "DISPUTED" ? "DISPUTED" : "PAUSED";
          const paused = await transaction.milestone.updateMany({
            where: {
              id: milestone.id,
              projectId: request.projectId,
              status: milestone.status,
              paymentStatus: "ESCROW",
              pausedAt: null,
            },
            data: { status: nextStatus, pausedAt: now },
          });
          if (paused.count !== 1) throw new Error("Milestone đã thay đổi khi tạm dừng dự án.");
          pausedMilestones.push({ id: milestone.id, previousStatus: milestone.status });
          await transaction.projectWorkflowEvent.create({
            data: {
              projectId: request.projectId,
              milestoneId: milestone.id,
              actorUserId,
              eventType: "MILESTONE_PAUSED",
              fromStatus: milestone.status,
              toStatus: nextStatus,
              detailsJson: JSON.stringify({ requestId }),
              idempotencyKey: `milestone-paused:${requestId}:${milestone.id}`,
              createdAt: now,
            },
          });
        }
        const pauseRequestUpdated = await transaction.projectChangeRequest.updateMany({
          where: { id: requestId, status: "ACCEPTED" },
          data: {
            payloadJson: JSON.stringify({
              ...payload,
              pausedMilestones,
              pausedAt: now.toISOString(),
            }),
          },
        });
        if (pauseRequestUpdated.count !== 1) {
          throw new Error("Không thể lưu trạng thái Milestone khi tạm dừng.");
        }
        break;
      }
      case "RESUME": {
        const pausedAt = request.project.pausedAt;
        if (!pausedAt) throw new Error("Dự án hiện không tạm dừng.");
        const pauseRequest = await transaction.projectChangeRequest.findFirst({
          where: {
            projectId: request.projectId,
            kind: "PAUSE",
            status: "ACCEPTED",
          },
          orderBy: { resolvedAt: "desc" },
          select: { payloadJson: true },
        });
        const pausePayload = JSON.parse(
          pauseRequest?.payloadJson ?? "{}",
        ) as ProjectChangeRequestPayload & {
          pausedMilestones?: { id: string; previousStatus: string }[];
        };
        if (!pausePayload.pausedMilestones) {
          throw new Error("Không tìm thấy trạng thái Milestone trước khi tạm dừng.");
        }
        const changed = await transaction.project.updateMany({
          where: { id: request.projectId, status: "IN_PROGRESS", pausedAt },
          data: {
            pausedAt: null,
            pausedTotalSeconds: {
              increment: Math.max(0, Math.floor((now.getTime() - pausedAt.getTime()) / 1000)),
            },
          },
        });
        if (changed.count !== 1) throw new Error("Dự án đã tiếp tục hoặc thay đổi trạng thái.");
        const pausedMilestones = await transaction.milestone.findMany({
          where: { projectId: request.projectId, pausedAt: { not: null } },
          select: { id: true, status: true, pausedAt: true },
        });
        for (const milestone of pausedMilestones) {
          const previousStatus = pausePayload.pausedMilestones.find(
            (item) => item.id === milestone.id,
          )?.previousStatus;
          if (!previousStatus || !milestone.pausedAt) {
            throw new Error("Không thể khôi phục trạng thái Milestone đã tạm dừng.");
          }
          const resumed = await transaction.milestone.updateMany({
            where: {
              id: milestone.id,
              projectId: request.projectId,
              status: milestone.status,
              pausedAt: milestone.pausedAt,
              paymentStatus: "ESCROW",
            },
            data: {
              status: previousStatus,
              pausedAt: null,
              pausedTotalSeconds: {
                increment: Math.max(
                  0,
                  Math.floor((now.getTime() - milestone.pausedAt.getTime()) / 1000),
                ),
              },
            },
          });
          if (resumed.count !== 1) throw new Error("Milestone đã thay đổi khi tiếp tục dự án.");
          await transaction.projectWorkflowEvent.create({
            data: {
              projectId: request.projectId,
              milestoneId: milestone.id,
              actorUserId,
              eventType: "MILESTONE_RESUMED",
              fromStatus: milestone.status,
              toStatus: previousStatus,
              detailsJson: JSON.stringify({ requestId }),
              idempotencyKey: `milestone-resumed:${requestId}:${milestone.id}`,
              createdAt: now,
            },
          });
        }
        break;
      }
      case "MILESTONE_CANCEL": {
        if (!request.milestoneId) throw new Error("Yêu cầu hủy mốc cần milestoneId.");
        await refundUnreleasedMilestones(
          transaction,
          request.projectId,
          [request.milestoneId],
          `refund:${requestId}`,
          actorUserId,
          now,
        );
        const openDisputes = await transaction.projectChangeRequest.findMany({
          where: {
            projectId: request.projectId,
            milestoneId: request.milestoneId,
            kind: { in: ["DISPUTE", "DISPUTE_RESOLUTION"] },
            status: "OPEN",
          },
          select: { id: true, kind: true },
        });
        for (const openDispute of openDisputes) {
          const closed = await transaction.projectChangeRequest.updateMany({
            where: { id: openDispute.id, status: "OPEN" },
            data: { status: "RESOLVED", resolvedAt: now },
          });
          if (closed.count !== 1) throw new Error("Không thể đóng bất đồng khi hủy Milestone.");
          await transaction.projectWorkflowEvent.create({
            data: {
              projectId: request.projectId,
              milestoneId: request.milestoneId,
              actorUserId,
              eventType: `MILESTONE_${openDispute.kind}_CLOSED_BY_CANCELLATION`,
              fromStatus: "DISPUTED",
              toStatus: "CANCELLED",
              detailsJson: JSON.stringify({ cancellationRequestId: requestId, disputeRequestId: openDispute.id }),
              idempotencyKey: `project-dispute-cancellation:${openDispute.id}`,
              createdAt: now,
            },
          });
        }
        await settleEscrowIfAllMilestonesResolved(transaction, request.projectId);
        break;
      }
      case "DISPUTE": {
        throw new Error("Bất đồng được mở ngay; hãy xử lý bằng DISPUTE_RESOLUTION.");
      }
      case "DISPUTE_RESOLUTION": {
        if (!request.milestoneId || request.milestone?.status !== "DISPUTED") {
          throw new Error("Không tìm thấy bất đồng đang mở trên Milestone.");
        }
        const openDispute = await transaction.projectChangeRequest.findFirst({
          where: {
            projectId: request.projectId,
            milestoneId: request.milestoneId,
            kind: "DISPUTE",
            status: "OPEN",
          },
          select: { id: true, payloadJson: true },
        });
        if (!openDispute) throw new Error("Không tìm thấy yêu cầu bất đồng đang mở.");
        const disputePayload = JSON.parse(openDispute.payloadJson || "{}") as
          ProjectChangeRequestPayload & { previousStatus?: string };
        const restoredStatus = deriveRestoredMilestoneStatus({
          ...request.milestone,
          started: ["IN_PROGRESS", "NEEDS_REVISION", "AWAITING_ACCEPTANCE"].includes(
            disputePayload.previousStatus ?? "",
          ),
        });
        const changed = await transaction.milestone.updateMany({
          where: {
            id: request.milestoneId,
            projectId: request.projectId,
            status: "DISPUTED",
            acceptanceStatus: request.milestone.acceptanceStatus,
            paymentStatus: request.milestone.paymentStatus,
          },
          data: { status: restoredStatus },
        });
        if (changed.count !== 1) throw new Error("Milestone đã thay đổi. Vui lòng tải lại.");
        const dispute = await transaction.projectChangeRequest.updateMany({
          where: {
            projectId: request.projectId,
            milestoneId: request.milestoneId,
            kind: "DISPUTE",
            status: "OPEN",
          },
          data: { status: "RESOLVED", resolvedAt: now },
        });
        if (dispute.count !== 1) throw new Error("Không tìm thấy yêu cầu bất đồng đang mở.");
        await transaction.projectWorkflowEvent.create({
          data: {
            projectId: request.projectId,
            milestoneId: request.milestoneId,
            actorUserId,
            eventType: "MILESTONE_DISPUTE_RESOLVED",
            fromStatus: "DISPUTED",
            toStatus: restoredStatus,
            detailsJson: JSON.stringify({ requestId }),
            idempotencyKey: `project-dispute-resolved:${requestId}`,
            createdAt: now,
          },
        });
        break;
      }
      case "PROJECT_TERMINATION": {
        const unreleasedMilestones = await transaction.milestone.findMany({
          where: { projectId: request.projectId, paymentStatus: "ESCROW" },
          select: { id: true },
        });
        const refundableAmount = await getUnreleasedRefundableAmount(
          transaction,
          request.projectId,
        );
        if (unreleasedMilestones.length === 0 || refundableAmount <= 0) {
          throw new Error("Không còn mốc chưa giải ngân.");
        }
        await refundUnreleasedMilestones(
          transaction,
          request.projectId,
          unreleasedMilestones.map(({ id }) => id),
          `refund:${requestId}`,
          actorUserId,
          now,
        );
        const depositClosed = await transaction.projectTransaction.updateMany({
          where: {
            projectId: request.projectId,
            type: "DEPOSIT",
            status: "ESCROW",
          },
          data: { status: "REFUNDED" },
        });
        if (depositClosed.count !== 1) {
          throw new Error("Khoản escrow đã được xử lý; không thể chấm dứt dự án.");
        }
        const openDisputes = await transaction.projectChangeRequest.findMany({
          where: {
            projectId: request.projectId,
            kind: { in: ["DISPUTE", "DISPUTE_RESOLUTION"] },
            status: "OPEN",
          },
          select: { id: true, milestoneId: true, kind: true },
        });
        for (const dispute of openDisputes) {
          const closed = await transaction.projectChangeRequest.updateMany({
            where: { id: dispute.id, status: "OPEN" },
            data: { status: "RESOLVED", resolvedAt: now },
          });
          if (closed.count !== 1) throw new Error("Không thể đóng bất đồng khi chấm dứt dự án.");
          await transaction.projectWorkflowEvent.create({
            data: {
              projectId: request.projectId,
              milestoneId: dispute.milestoneId,
              actorUserId,
              eventType: `MILESTONE_${dispute.kind}_CLOSED_BY_TERMINATION`,
              fromStatus: "DISPUTED",
              toStatus: "CANCELLED",
              detailsJson: JSON.stringify({ terminationRequestId: requestId, disputeRequestId: dispute.id }),
              idempotencyKey: `project-dispute-termination:${dispute.id}`,
              createdAt: now,
            },
          });
        }
        const otherOpenRequests = await transaction.projectChangeRequest.findMany({
          where: {
            projectId: request.projectId,
            status: "OPEN",
            id: { not: requestId },
          },
          select: { id: true, milestoneId: true, kind: true },
        });
        for (const otherRequest of otherOpenRequests) {
          const closed = await transaction.projectChangeRequest.updateMany({
            where: { id: otherRequest.id, status: "OPEN" },
            data: { status: "REJECTED", resolvedAt: now },
          });
          if (closed.count !== 1) {
            throw new Error("Không thể đóng yêu cầu đang chờ khi chấm dứt dự án.");
          }
          await transaction.projectWorkflowEvent.create({
            data: {
              projectId: request.projectId,
              milestoneId: otherRequest.milestoneId,
              actorUserId,
              eventType: `PROJECT_CHANGE_CLOSED_BY_TERMINATION_${otherRequest.kind}`,
              fromStatus: "OPEN",
              toStatus: "REJECTED",
              detailsJson: JSON.stringify({ terminationRequestId: requestId }),
              idempotencyKey: `project-change-termination:${requestId}:${otherRequest.id}`,
              createdAt: now,
            },
          });
        }
        const cancelled = await transaction.project.updateMany({
          where: {
            id: request.projectId,
            status: "IN_PROGRESS",
            cancelledAt: null,
            finalAcceptedAt: null,
          },
          data: {
            status: "CANCELLED",
            cancelledAt: now,
            finalAcceptanceStatus: "NOT_REQUESTED",
          },
        });
        if (cancelled.count !== 1) throw new Error("Dự án đã chấm dứt hoặc thay đổi trạng thái.");
        const teamOwnerId = request.project.team.ownerId;
        if (!teamOwnerId) throw new Error("Dự án chưa có chủ nhóm để thông báo chấm dứt.");
        await transaction.notification.createMany({
          data: [
            {
              userId: businessUserId,
              dedupeKey: `project-terminated:${requestId}:business`,
              title: "Dự án đã chấm dứt",
              message: `Dự án “${request.project.title}” đã được hai bên xác nhận chấm dứt. Phần escrow chưa giải ngân đã được hoàn lại.`,
              href: getProjectNotificationHref("BUSINESS", request.projectId),
              createdAt: now,
            },
            {
              userId: teamOwnerId,
              dedupeKey: `project-terminated:${requestId}:team`,
              title: "Dự án đã chấm dứt",
              message: `Dự án “${request.project.title}” đã được hai bên xác nhận chấm dứt.`,
              href: getProjectNotificationHref("STUDENT", request.projectId),
              createdAt: now,
            },
          ],
        });
        break;
      }
    }

    await transaction.projectWorkflowEvent.create({
      data: {
        projectId: request.projectId,
        milestoneId: request.milestoneId,
        actorUserId,
        eventType: `PROJECT_CHANGE_ACCEPTED_${request.kind}`,
        fromStatus: "OPEN",
        toStatus: "ACCEPTED",
        detailsJson: JSON.stringify({ requestId, payload }),
        idempotencyKey: `project-change-accepted:${requestId}`,
        createdAt: now,
      },
    });
    return { status: "ACCEPTED" };
  });
}

export async function ensurePendingProjectChangeRequestReminders(
  projectId: string,
  {
    database,
    now = new Date(),
  }: {
    database: Pick<PrismaClient, "projectChangeRequest" | "notification" | "project" | "milestone">;
    now?: Date;
  },
) {
  const threshold = getProjectChangeReminderHours() * projectReminderHourMs;
  const pending = await database.projectChangeRequest.findMany({
    where: {
      projectId,
      status: "OPEN",
      kind: { not: "DISPUTE" },
      createdAt: { lt: new Date(now.getTime() - threshold) },
    },
    include: {
      project: {
        select: {
          application: {
            select: {
              problem: { select: { businessProfile: { select: { userId: true } } } },
            },
          },
          team: { select: { ownerId: true } },
        },
      },
    },
  });
  for (const request of pending) {
    const businessUserId = request.project.application.problem.businessProfile.userId;
    const targetUserId =
      request.businessAcceptedAt === null && request.teamAcceptedAt === null
        ? request.requestedByUserId === businessUserId
          ? request.project.team.ownerId
          : businessUserId
        : request.businessAcceptedAt === null
          ? businessUserId
        : request.teamAcceptedAt === null
          ? request.project.team.ownerId
          : request.requestedByUserId === businessUserId
            ? request.project.team.ownerId
            : businessUserId;
    if (!targetUserId) continue;
    const dedupeKey = `project-change-reminder:${request.id}:${targetUserId}`;
    try {
      await database.notification.create({
        data: {
          userId: targetUserId,
          dedupeKey,
          title: "Nhắc xác nhận thay đổi dự án",
          message: `Có yêu cầu ${request.kind} đang chờ xác nhận từ bạn.`,
          href: getProjectNotificationHref(targetUserId === businessUserId ? "BUSINESS" : "STUDENT", projectId),
          createdAt: now,
        },
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
    }
  }

  const pausedProject = await database.project.findFirst({
    where: { id: projectId, status: "IN_PROGRESS", pausedAt: { not: null } },
    include: {
      team: { select: { ownerId: true, memberships: { select: { studentProfile: { select: { userId: true } } } } } },
      application: {
        select: {
          problem: { select: { businessProfile: { select: { userId: true } } } },
        },
      },
      changeRequests: {
        where: { kind: "PAUSE", status: "ACCEPTED" },
        orderBy: { resolvedAt: "desc" },
        take: 1,
        select: { payloadJson: true },
      },
    },
  });
  if (!pausedProject?.pausedAt) return;
  const pausePayload = JSON.parse(pausedProject.changeRequests[0]?.payloadJson ?? "{}") as ProjectChangeRequestPayload;
  const pauseDays = pausePayload.days ?? projectReminderConfig.pauseMaxDays;
  const pausedForMs = now.getTime() - pausedProject.pausedAt.getTime();
  if (pausedForMs < pauseDays * 24 * projectReminderHourMs) return;
  const pausedAtKey = pausedProject.pausedAt.toISOString();
  const recipients = [
    pausedProject.application.problem.businessProfile.userId,
    ...(pausedProject.team.ownerId ? [pausedProject.team.ownerId] : []),
  ];
  const businessUserId = pausedProject.application.problem.businessProfile.userId;
  for (const userId of new Set(recipients)) {
    const dedupeKey = `project-pause-overdue:${projectId}:${pausedAtKey}:${userId}`;
    try {
      await database.notification.create({
        data: {
          userId,
          dedupeKey,
          title: "Dự án đã quá thời gian tạm dừng dự kiến",
          message: `Dự án “${pausedProject.title}” đã tạm dừng quá thời hạn dự kiến. Hai bên vui lòng xác nhận tiếp tục hoặc thống nhất gia hạn.`,
          href: getProjectNotificationHref(userId === businessUserId ? "BUSINESS" : "STUDENT", projectId),
          createdAt: now,
        },
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
    }
  }
}

export async function createProjectSupportNote(
  database: Pick<PrismaClient, "$transaction">,
  {
    projectId,
    adminUserId,
    actorRole,
    note,
    milestoneId,
    changeRequestId,
    now = new Date(),
  }: {
    projectId: string;
    adminUserId: string;
    actorRole: string;
    note: string;
    milestoneId?: string;
    changeRequestId?: string;
    now?: Date;
  },
) {
  if (actorRole !== "ADMIN") throw new Error("Chỉ Admin mới có thể ghi chú hỗ trợ.");
  if (!note.trim() || note.length > 4_000) {
    throw new Error("Ghi chú hỗ trợ bắt buộc và tối đa 4.000 ký tự.");
  }
  return database.$transaction(async (transaction) => {
    const project = await transaction.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) throw new Error("Không tìm thấy dự án.");
    if (milestoneId) {
      const milestone = await transaction.milestone.findFirst({
        where: { id: milestoneId, projectId },
        select: { id: true },
      });
      if (!milestone) throw new Error("Milestone không thuộc dự án.");
    }
    if (changeRequestId) {
      const request = await transaction.projectChangeRequest.findFirst({
        where: { id: changeRequestId, projectId },
        select: { id: true },
      });
      if (!request) throw new Error("Yêu cầu thay đổi không thuộc dự án.");
    }
    const supportNote = await transaction.projectSupportNote.create({
      data: {
        projectId,
        adminUserId,
        note: note.trim(),
        milestoneId: milestoneId ?? null,
        changeRequestId: changeRequestId ?? null,
        createdAt: now,
      },
    });
    await writeAuditLog(transaction, {
      actorId: adminUserId,
      action: "PROJECT_SUPPORT_NOTE_ADDED",
      targetType: "Project",
      targetId: projectId,
      metadata: { supportNoteId: supportNote.id },
    });
    return supportNote;
  });
}

export async function resolveProjectDisputeForAdmin(
  database: Pick<PrismaClient, "$transaction">,
  {
    projectId,
    disputeRequestId,
    adminUserId,
    actorRole,
    outcome,
    reason,
    now = new Date(),
  }: {
    projectId: string;
    disputeRequestId: string;
    adminUserId: string;
    actorRole: string;
    outcome: "RESUME_WORK" | "GUIDE_TERMINATION";
    reason: string;
    now?: Date;
  },
) {
  if (actorRole !== "ADMIN") throw new Error("Chỉ Admin mới có thể hỗ trợ bất đồng.");
  if (!reason.trim() || reason.length > 4_000) {
    throw new Error("Lý do hỗ trợ bắt buộc và tối đa 4.000 ký tự.");
  }
  return database.$transaction(async (transaction) => {
    const dispute = await transaction.projectChangeRequest.findFirst({
      where: {
        id: disputeRequestId,
        projectId,
        kind: "DISPUTE",
        status: "OPEN",
      },
      include: {
        milestone: {
          select: {
            id: true,
            status: true,
            acceptanceStatus: true,
            paymentStatus: true,
          },
        },
        project: { select: { status: true, pausedAt: true } },
      },
    });
    if (!dispute?.milestone) throw new Error("Không tìm thấy bất đồng đang mở.");
    assertProjectActionable(dispute.project);
    if (dispute.project.pausedAt) {
      throw new Error("Cần thống nhất tiếp tục dự án trước khi mở khóa Milestone.");
    }

    let restoredStatus: string | null = null;
    if (outcome === "RESUME_WORK") {
      const payload = JSON.parse(dispute.payloadJson || "{}") as
        ProjectChangeRequestPayload & { previousStatus?: string };
      if (!payload.previousStatus) {
        throw new Error("Không có trạng thái trước bất đồng để khôi phục.");
      }
      restoredStatus = deriveRestoredMilestoneStatus({
        ...dispute.milestone,
        started: ["IN_PROGRESS", "NEEDS_REVISION", "AWAITING_ACCEPTANCE"].includes(
          payload.previousStatus,
        ),
      });
      const milestoneUpdated = await transaction.milestone.updateMany({
        where: {
          id: dispute.milestone.id,
          projectId,
          status: "DISPUTED",
          acceptanceStatus: dispute.milestone.acceptanceStatus,
          paymentStatus: "ESCROW",
        },
        data: { status: restoredStatus },
      });
      if (milestoneUpdated.count !== 1) {
        throw new Error("Milestone đã thay đổi; không thể mở khóa bất đồng.");
      }
      const requestUpdated = await transaction.projectChangeRequest.updateMany({
        where: { id: disputeRequestId, projectId, kind: "DISPUTE", status: "OPEN" },
        data: { status: "RESOLVED", resolvedAt: now },
      });
      if (requestUpdated.count !== 1) throw new Error("Bất đồng đã được xử lý.");
    } else if (outcome !== "GUIDE_TERMINATION") {
      throw new Error("Kết quả hỗ trợ bất đồng không hợp lệ.");
    }

    const outcomeLabel =
      outcome === "RESUME_WORK"
        ? "Tiếp tục thực hiện"
        : "Hướng dẫn hai bên tạo yêu cầu hủy mốc/chấm dứt";
    await transaction.projectSupportNote.create({
      data: {
        projectId,
        milestoneId: dispute.milestone.id,
        changeRequestId: disputeRequestId,
        adminUserId,
        note: `Kết quả hỗ trợ: ${outcomeLabel}\nLý do: ${reason.trim()}`,
        createdAt: now,
      },
    });
    await transaction.projectWorkflowEvent.create({
      data: {
        projectId,
        milestoneId: dispute.milestone.id,
        actorUserId: adminUserId,
        eventType: `ADMIN_DISPUTE_SUPPORT_${outcome}`,
        fromStatus: "DISPUTED",
        toStatus: restoredStatus ?? "DISPUTED",
        detailsJson: JSON.stringify({ disputeRequestId, outcome, reason: reason.trim() }),
        idempotencyKey: `admin-dispute-support:${disputeRequestId}:${outcome}`,
        createdAt: now,
      },
    });
    await writeAuditLog(transaction, {
      actorId: adminUserId,
      action: `PROJECT_DISPUTE_SUPPORT_${outcome}`,
      targetType: "Project",
      targetId: projectId,
      metadata: { disputeRequestId, restoredStatus },
    });
    return { outcome };
  });
}

export function getProjectChangeRequestStatusLabel(kind: string, status: string): string {
  if (kind === "DISPUTE" && status === "OPEN") return "Có bất đồng - Chờ xử lý";
  if (status === "OPEN") return "Đang chờ xác nhận";
  if (status === "ACCEPTED") return "Đã đồng ý";
  if (status === "REJECTED") return "Đã từ chối";
  if (status === "RESOLVED" || status === "CLOSED_BY_TERMINATION") return "Đã xử lý";
  if (kind === "DISPUTE") return "Bất đồng";
  return status;
}
