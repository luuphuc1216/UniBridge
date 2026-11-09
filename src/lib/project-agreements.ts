import { Prisma, type ProjectAgreementVersion } from "@/generated/prisma/client";
import {
  businessFeeRate,
  studentFeeRate,
} from "@/lib/project-config";
import { calculateProjectFinancialBreakdown } from "@/lib/project-money";
import { canRespondForTeam } from "@/lib/team-permissions";
import { getProjectNotificationHref } from "@/lib/project-notification-links";

export type AgreementMilestoneSnapshot = {
  title: string;
  description: string;
  acceptanceCriteria: string;
  dueAt: string;
  paymentPercent: number;
};

export type AgreementSnapshot = {
  title: string;
  agreedScope: string;
  deliverables: string;
  duration: string;
  totalAmount: number;
  generalAcceptanceCriteria: string;
  businessResponsibilities: string;
  teamResponsibilities: string;
  paymentMethod: string;
  maxMilestoneRevisions: number;
  ownershipTerms: string;
  usageTerms: string;
  confidentialityTerms: string;
  extensionTerms: string;
  suspensionTerms: string;
  terminationTerms: string;
  disputeTerms: string;
  milestones: AgreementMilestoneSnapshot[];
};

export type AgreementVersionInput = Omit<AgreementSnapshot, "milestones"> & {
  milestones: AgreementMilestoneSnapshot[];
};

export const staleAgreementMessage = "Hồ sơ vừa được cập nhật, vui lòng tải lại.";

export function getAgreementResponseMode({
  legacyTermsExempt,
  role,
  teamOwnerId,
  actorUserId,
}: {
  legacyTermsExempt: boolean;
  role: string;
  teamOwnerId: string | null;
  actorUserId: string;
}): "LEGACY" | "VERSIONED" {
  if (!["BUSINESS", "STUDENT"].includes(role)) {
    throw new Error("Tài khoản không được phép phản hồi thỏa thuận.");
  }
  if (role === "STUDENT" && !canRespondForTeam(teamOwnerId, actorUserId)) {
    throw new Error("Chỉ chủ nhóm của dự án mới có thể phản hồi phiên bản thỏa thuận.");
  }
  if (legacyTermsExempt) return "LEGACY";
  if (role === "STUDENT") return "VERSIONED";
  throw new Error("Thỏa thuận mới chỉ được xác nhận qua phiên bản điều khoản.");
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export function getAgreementErrorMessage(error: unknown): string | null {
  return isUniqueViolation(error) ? staleAgreementMessage : null;
}

function validateAgreementSnapshot(snapshot: AgreementSnapshot): void {
  const requiredTerms = [
    snapshot.title,
    snapshot.agreedScope,
    snapshot.deliverables,
    snapshot.duration,
    snapshot.generalAcceptanceCriteria,
    snapshot.businessResponsibilities,
    snapshot.teamResponsibilities,
    snapshot.paymentMethod,
    snapshot.ownershipTerms,
    snapshot.usageTerms,
    snapshot.confidentialityTerms,
    snapshot.extensionTerms,
    snapshot.suspensionTerms,
    snapshot.terminationTerms,
    snapshot.disputeTerms,
  ];
  if (
    requiredTerms.some((term) => !term.trim()) ||
    !Number.isSafeInteger(snapshot.totalAmount) ||
    snapshot.totalAmount <= 0 ||
    !Number.isInteger(snapshot.maxMilestoneRevisions) ||
    snapshot.maxMilestoneRevisions < 0 ||
    snapshot.milestones.length === 0 ||
    snapshot.milestones.length > 20
  ) {
    throw new Error("Thỏa thuận hoặc điều khoản không hợp lệ.");
  }
  calculateProjectFinancialBreakdown(
    snapshot.totalAmount,
    snapshot.milestones.map(({ paymentPercent }) => paymentPercent),
    businessFeeRate,
    studentFeeRate,
  );
  for (const milestone of snapshot.milestones) {
    const parsedDueDate = new Date(`${milestone.dueAt}T12:00:00.000Z`);
    if (
      !milestone.title.trim() ||
      !milestone.description.trim() ||
      !milestone.acceptanceCriteria.trim() ||
      !/^\d{4}-\d{2}-\d{2}$/.test(milestone.dueAt) ||
      !Number.isFinite(parsedDueDate.getTime()) ||
      parsedDueDate.toISOString().slice(0, 10) !== milestone.dueAt ||
      !Number.isInteger(milestone.paymentPercent)
    ) {
      throw new Error("Snapshot Milestone không hợp lệ.");
    }
  }
}

export function readAgreementSnapshot(
  version: Pick<
    ProjectAgreementVersion,
    | "title"
    | "agreedScope"
    | "deliverables"
    | "duration"
    | "totalAmount"
    | "generalAcceptanceCriteria"
    | "businessResponsibilities"
    | "teamResponsibilities"
    | "paymentMethod"
    | "maxMilestoneRevisions"
    | "ownershipTerms"
    | "usageTerms"
    | "confidentialityTerms"
    | "extensionTerms"
    | "suspensionTerms"
    | "terminationTerms"
    | "disputeTerms"
    | "milestonesSnapshot"
  >,
): AgreementSnapshot {
  let milestones: AgreementMilestoneSnapshot[];
  try {
    milestones = JSON.parse(version.milestonesSnapshot) as AgreementMilestoneSnapshot[];
  } catch {
    throw new Error("Snapshot Milestone của phiên bản thỏa thuận bị lỗi.");
  }
  if (!Array.isArray(milestones)) {
    throw new Error("Snapshot Milestone của phiên bản thỏa thuận không hợp lệ.");
  }
  const snapshot: AgreementSnapshot = {
    title: version.title,
    agreedScope: version.agreedScope,
    deliverables: version.deliverables,
    duration: version.duration,
    totalAmount: version.totalAmount,
    generalAcceptanceCriteria: version.generalAcceptanceCriteria,
    businessResponsibilities: version.businessResponsibilities,
    teamResponsibilities: version.teamResponsibilities,
    paymentMethod: version.paymentMethod,
    maxMilestoneRevisions: version.maxMilestoneRevisions,
    ownershipTerms: version.ownershipTerms,
    usageTerms: version.usageTerms,
    confidentialityTerms: version.confidentialityTerms,
    extensionTerms: version.extensionTerms,
    suspensionTerms: version.suspensionTerms,
    terminationTerms: version.terminationTerms,
    disputeTerms: version.disputeTerms,
    milestones,
  };
  validateAgreementSnapshot(snapshot);
  return snapshot;
}

export async function createProjectAgreementVersion(
  transaction: Prisma.TransactionClient,
  {
    projectId,
    expectedVersionNumber,
    createdByUserId,
    input,
    now = new Date(),
  }: {
    projectId: string;
    expectedVersionNumber: number;
    createdByUserId: string;
    input: AgreementVersionInput;
    now?: Date;
  },
) {
  validateAgreementSnapshot(input);
  const project = await transaction.project.findUnique({
    where: { id: projectId },
    select: {
      status: true,
      legacyTermsExempt: true,
      transactions: { where: { type: "DEPOSIT" }, select: { id: true }, take: 1 },
      team: { select: { ownerId: true } },
      application: {
        select: {
          problem: { select: { businessProfile: { select: { userId: true } } } },
        },
      },
    },
  });
  if (
    !project ||
    project.legacyTermsExempt ||
    project.status !== "AGREEING" ||
    project.transactions.length > 0 ||
    project.application.problem.businessProfile.userId !== createdByUserId
  ) {
    throw new Error("Thỏa thuận không thể tạo phiên bản mới ở trạng thái hiện tại.");
  }
  const latest = await transaction.projectAgreementVersion.findFirst({
    where: { projectId },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true },
  });
  const latestVersionNumber = latest?.versionNumber ?? 0;
  if (latestVersionNumber !== expectedVersionNumber) {
    throw new Error(staleAgreementMessage);
  }
  const versionNumber = latestVersionNumber + 1;
  await transaction.projectWorkflowEvent.create({
    data: {
      projectId,
      actorUserId: createdByUserId,
      eventType: "AGREEMENT_VERSION_CREATED",
      detailsJson: JSON.stringify({ versionNumber }),
      idempotencyKey: `agreement-version:${projectId}:v${versionNumber}`,
      createdAt: now,
    },
  });
  await transaction.projectChangeRequest.updateMany({
    where: { projectId, kind: "AGREEMENT_REVISION", status: "OPEN" },
    data: { status: "SUPERSEDED", resolvedAt: now },
  });
  return transaction.projectAgreementVersion.create({
    data: {
      projectId,
      versionNumber,
      status: "PENDING_TEAM",
      title: input.title,
      agreedScope: input.agreedScope,
      deliverables: input.deliverables,
      duration: input.duration,
      totalAmount: input.totalAmount,
      generalAcceptanceCriteria: input.generalAcceptanceCriteria,
      businessResponsibilities: input.businessResponsibilities,
      teamResponsibilities: input.teamResponsibilities,
      paymentMethod: input.paymentMethod,
      maxMilestoneRevisions: input.maxMilestoneRevisions,
      ownershipTerms: input.ownershipTerms,
      usageTerms: input.usageTerms,
      confidentialityTerms: input.confidentialityTerms,
      extensionTerms: input.extensionTerms,
      suspensionTerms: input.suspensionTerms,
      terminationTerms: input.terminationTerms,
      disputeTerms: input.disputeTerms,
      milestonesSnapshot: JSON.stringify(input.milestones),
      createdByUserId,
      businessAcceptedAt: now,
      businessAcceptedByUserId: createdByUserId,
    },
  });
}

export async function saveProjectAgreementVersion(
  transaction: Prisma.TransactionClient,
  {
    projectId,
    expectedVersionNumber,
    createdByUserId,
    input,
    team,
    now = new Date(),
  }: {
    projectId: string;
    expectedVersionNumber: number;
    createdByUserId: string;
    input: AgreementVersionInput;
    team: {
      ownerId: string | null;
      memberships: { studentProfile: { userId: string } | null }[];
    };
    now?: Date;
  },
) {
  const project = await transaction.project.findUnique({
    where: { id: projectId },
    select: {
      status: true,
      legacyTermsExempt: true,
      transactions: { where: { type: "DEPOSIT" }, select: { id: true }, take: 1 },
    },
  });
  if (
    !project ||
    project.legacyTermsExempt ||
    project.status !== "AGREEING" ||
    project.transactions.length > 0
  ) {
    throw new Error("Không thể tạo phiên bản điều khoản sau khi nạp hoặc đổi trạng thái.");
  }
  const version = await createProjectAgreementVersion(transaction, {
    projectId,
    expectedVersionNumber,
    createdByUserId,
    input,
    now,
  });
  await createAgreementVersionNotifications(transaction, {
    projectId,
    versionNumber: version.versionNumber,
    title: version.title,
    team,
    now,
  });
  return version;
}

export async function createProjectWithFirstAgreementVersion(
  transaction: Prisma.TransactionClient,
  {
    applicationId,
    teamId,
    createdByUserId,
    input,
    team,
    now = new Date(),
  }: {
    applicationId: string;
    teamId: string;
    createdByUserId: string;
    input: AgreementVersionInput;
    team: {
      ownerId: string | null;
      memberships: { studentProfile: { userId: string } | null }[];
    };
    now?: Date;
  },
) {
  validateAgreementSnapshot(input);
  const breakdown = calculateProjectFinancialBreakdown(
    input.totalAmount,
    input.milestones.map(({ paymentPercent }) => paymentPercent),
    businessFeeRate,
    studentFeeRate,
  );
  const project = await transaction.project.create({
    data: {
      applicationId,
      teamId,
      title: input.title,
      agreedScope: input.agreedScope,
      deliverables: input.deliverables,
      duration: input.duration,
      totalAmount: input.totalAmount,
      generalAcceptanceCriteria: input.generalAcceptanceCriteria,
      businessResponsibilities: input.businessResponsibilities,
      teamResponsibilities: input.teamResponsibilities,
      paymentMethod: input.paymentMethod,
      status: "AGREEING",
      legacyTermsExempt: false,
      createdAt: now,
      milestones: {
        create: input.milestones.map((milestone, index) => ({
          title: milestone.title,
          description: milestone.description,
          acceptanceCriteria: milestone.acceptanceCriteria,
          paymentPercent: milestone.paymentPercent,
          amount: breakdown.milestones[index]?.grossAmount,
          dueAt: new Date(`${milestone.dueAt}T12:00:00.000Z`),
          sortOrder: index,
        })),
      },
    },
  });
  const version = await createProjectAgreementVersion(transaction, {
    projectId: project.id,
    expectedVersionNumber: 0,
    createdByUserId,
    input,
    now,
  });
  await createAgreementVersionNotifications(transaction, {
    projectId: project.id,
    versionNumber: version.versionNumber,
    title: version.title,
    team,
    now,
  });
  return project;
}

export async function getAcceptedProjectAgreementSnapshot(
  transaction: Prisma.TransactionClient,
  projectId: string,
): Promise<AgreementSnapshot> {
  const latest = await transaction.projectAgreementVersion.findFirst({
    where: { projectId },
    orderBy: { versionNumber: "desc" },
  });
  if (
    !latest ||
    latest.status !== "ACCEPTED" ||
    latest.businessAcceptedAt === null ||
    latest.teamAcceptedAt === null ||
    latest.businessAcceptedByUserId === null ||
    latest.teamAcceptedByUserId === null
  ) {
    throw new Error("Chưa có phiên bản thỏa thuận được cả hai bên xác nhận.");
  }
  return readAgreementSnapshot(latest);
}

export async function respondToLegacyProjectAgreement(
  transaction: Prisma.TransactionClient,
  {
    projectId,
    actorUserId,
    role,
    response,
    note = "",
    now = new Date(),
  }: {
    projectId: string;
    actorUserId: string;
    role: "BUSINESS" | "STUDENT";
    response: "ACCEPT" | "REQUEST_CHANGES";
    note?: string;
    now?: Date;
  },
): Promise<void> {
  const project = await transaction.project.findUnique({
    where: { id: projectId },
    include: {
      milestones: { orderBy: { sortOrder: "asc" } },
      team: {
        select: {
          ownerId: true,
          memberships: { select: { studentProfile: { select: { userId: true } } } },
        },
      },
      application: {
        select: {
          problem: { select: { title: true, businessProfile: { select: { userId: true } } } },
        },
      },
    },
  });
  if (!project?.legacyTermsExempt || project.status !== "AGREEING") {
    throw new Error("Thỏa thuận mới chỉ được xử lý qua phiên bản điều khoản.");
  }
  const businessUserId = project.application.problem.businessProfile.userId;
  if (
    (role === "BUSINESS" && businessUserId !== actorUserId) ||
    (role === "STUDENT" && !canRespondForTeam(project.team.ownerId, actorUserId))
  ) {
    throw new Error("Bạn không có quyền phản hồi thỏa thuận này.");
  }
  const teamUserIds = [
    ...new Set(
      [
        project.team.ownerId,
        ...project.team.memberships.map(({ studentProfile }) => studentProfile?.userId),
      ].filter((userId): userId is string => Boolean(userId)),
    ),
  ];

  if (response === "REQUEST_CHANGES") {
    if (role !== "STUDENT" || !note.trim() || note.length > 4000) {
      throw new Error("Nhóm cần ghi rõ đề nghị chỉnh sửa (tối đa 4.000 ký tự).");
    }
    const changed = await transaction.project.updateMany({
      where: { id: projectId, legacyTermsExempt: true, status: "AGREEING" },
      data: {
        revisionNote: note,
        businessAcceptedAt: null,
        teamAcceptedAt: null,
      },
    });
    if (changed.count !== 1) throw new Error("Thỏa thuận đã thay đổi. Vui lòng tải lại.");
    await transaction.notification.create({
      data: {
        userId: businessUserId,
        title: "Nhóm đề nghị chỉnh sửa thỏa thuận",
        message: `Nhóm gửi đề nghị chỉnh sửa cho dự án “${project.title}”.`,
        href: getProjectNotificationHref("BUSINESS", projectId),
        createdAt: now,
      },
    });
    return;
  }
  if (response !== "ACCEPT") throw new Error("Phản hồi thỏa thuận không hợp lệ.");
  if (project.revisionNote) {
    throw new Error("Doanh nghiệp cần cập nhật thỏa thuận theo đề nghị của nhóm trước khi đồng ý.");
  }
  calculateProjectFinancialBreakdown(
    project.totalAmount,
    project.milestones.map(({ paymentPercent }) => paymentPercent),
    businessFeeRate,
    studentFeeRate,
  );
  const acceptedAt =
    role === "BUSINESS" ? project.businessAcceptedAt : project.teamAcceptedAt;
  if (!acceptedAt) {
    const changed = await transaction.project.updateMany({
      where: {
        id: projectId,
        legacyTermsExempt: true,
        status: "AGREEING",
        agreementRevision: project.agreementRevision,
        revisionNote: null,
        ...(role === "BUSINESS"
          ? { businessAcceptedAt: null }
          : { teamAcceptedAt: null }),
      },
      data:
        role === "BUSINESS"
          ? { businessAcceptedAt: now }
          : { teamAcceptedAt: now },
    });
    if (changed.count !== 1) throw new Error("Thỏa thuận đã thay đổi. Vui lòng tải lại.");
  }
  const updated = await transaction.project.findUniqueOrThrow({ where: { id: projectId } });
  if (updated.businessAcceptedAt && updated.teamAcceptedAt) {
    const agreed = await transaction.project.updateMany({
      where: {
        id: projectId,
        legacyTermsExempt: true,
        status: "AGREEING",
        businessAcceptedAt: { not: null },
        teamAcceptedAt: { not: null },
      },
      data: { status: "AWAITING_PAYMENT", revisionNote: null },
    });
    if (agreed.count === 1) {
      await transaction.notification.createMany({
        data: [
          {
            userId: businessUserId,
            title: "Hai bên đã đồng ý thỏa thuận",
            message: `Thỏa thuận dự án “${project.title}” đã được xác nhận. Có thể nạp tiền giả lập.`,
            href: getProjectNotificationHref("BUSINESS", projectId),
            createdAt: now,
          },
          ...teamUserIds.map((userId) => ({
            userId,
            title: "Hai bên đã đồng ý thỏa thuận",
            message: `Thỏa thuận dự án “${project.title}” đã được xác nhận.`,
            href: getProjectNotificationHref("STUDENT", projectId),
            createdAt: now,
          })),
        ],
      });
    }
  } else {
    const otherPartyUserIds = role === "BUSINESS" ? teamUserIds : [businessUserId];
    await transaction.notification.createMany({
      data: otherPartyUserIds.map((userId) => ({
        userId,
        title: "Đối tác đã đồng ý thỏa thuận",
        message: `Một bên đã xác nhận phiên bản ${project.agreementRevision} của dự án “${project.title}”.`,
        href: getProjectNotificationHref(role === "BUSINESS" ? "STUDENT" : "BUSINESS", projectId),
        createdAt: now,
      })),
    });
  }
}

export async function respondToProjectAgreementVersion(
  transaction: Prisma.TransactionClient,
  {
    projectId,
    versionNumber,
    actorUserId,
    response,
    note = "",
    now = new Date(),
  }: {
    projectId: string;
    versionNumber: number;
    actorUserId: string;
    response: "ACCEPT" | "REQUEST_CHANGES";
    note?: string;
    now?: Date;
  },
): Promise<{ projectTitle: string; businessUserId: string; teamUserIds: string[]; awaitingPayment: boolean }> {
  await transaction.$queryRaw`
    SELECT "id"
    FROM "Project"
    WHERE "id" = ${projectId}
    FOR UPDATE
  `;

  const project = await transaction.project.findUnique({
    where: { id: projectId },
    include: {
      team: {
        select: {
          ownerId: true,
          memberships: { select: { studentProfile: { select: { userId: true } } } },
        },
      },
      application: {
        select: {
          problem: {
            select: { businessProfile: { select: { userId: true } } },
          },
        },
      },
      transactions: {
        where: { type: "DEPOSIT" },
        select: { id: true },
        take: 1,
      },
    },
  });
  if (
    project &&
    !project.legacyTermsExempt &&
    project.status === "AWAITING_PAYMENT" &&
    project.team.ownerId === actorUserId &&
    response === "ACCEPT"
  ) {
    const alreadyAccepted = await transaction.projectAgreementVersion.findFirst({
      where: {
        projectId,
        versionNumber,
        status: "ACCEPTED",
        teamAcceptedByUserId: actorUserId,
        teamAcceptedAt: { not: null },
      },
      select: { id: true },
    });
    if (alreadyAccepted) {
      return {
        projectTitle: project.title,
        businessUserId: project.application.problem.businessProfile.userId,
        teamUserIds: [
          ...new Set(
            [
              project.team.ownerId,
              ...project.team.memberships.map(
                ({ studentProfile }) => studentProfile?.userId,
              ),
            ].filter((userId): userId is string => Boolean(userId)),
          ),
        ],
        awaitingPayment: true,
      };
    }
  }
  if (
    !project ||
    project.legacyTermsExempt ||
    project.status !== "AGREEING" ||
    project.transactions.length > 0 ||
    project.team.ownerId !== actorUserId
  ) {
    throw new Error("Chỉ chủ nhóm của dự án đang thỏa thuận mới có thể phản hồi.");
  }
  if (response === "REQUEST_CHANGES" && (!note.trim() || note.length > 4000)) {
    throw new Error("Vui lòng ghi rõ đề nghị chỉnh sửa (tối đa 4.000 ký tự).");
  }
  const latest = await transaction.projectAgreementVersion.findFirst({
    where: { projectId },
    orderBy: { versionNumber: "desc" },
  });
  if (
    !latest ||
    latest.versionNumber !== versionNumber ||
    latest.status !== "PENDING_TEAM" ||
    latest.teamAcceptedAt !== null
  ) {
    throw new Error(staleAgreementMessage);
  }

  const changed = await transaction.projectAgreementVersion.updateMany({
    where: {
      id: latest.id,
      projectId,
      versionNumber,
      status: "PENDING_TEAM",
      teamAcceptedAt: null,
    },
    data:
      response === "ACCEPT"
        ? {
            status: "ACCEPTED",
            teamAcceptedAt: now,
            teamAcceptedByUserId: actorUserId,
          }
        : { status: "CHANGES_REQUESTED" },
  });
  if (changed.count !== 1) throw new Error(staleAgreementMessage);

  const teamUserIds = [
    ...new Set(
      [
        project.team.ownerId,
        ...project.team.memberships.map(({ studentProfile }) => studentProfile?.userId),
      ].filter((userId): userId is string => Boolean(userId)),
    ),
  ];
  const businessUserId = project.application.problem.businessProfile.userId;
  if (response === "REQUEST_CHANGES") {
    await transaction.projectChangeRequest.create({
      data: {
        projectId,
        kind: "AGREEMENT_REVISION",
        status: "OPEN",
        reason: note.trim(),
        payloadJson: JSON.stringify({ versionNumber }),
        requestedByUserId: actorUserId,
        idempotencyKey: `agreement-revision:${projectId}:v${versionNumber}`,
        createdAt: now,
        updatedAt: now,
      },
    });
    await transaction.notification.create({
      data: {
        userId: businessUserId,
        dedupeKey: `agreement-response:${projectId}:v${versionNumber}:business`,
        title: "Nhóm đề nghị chỉnh sửa thỏa thuận",
        message: `Nhóm gửi đề nghị chỉnh sửa cho phiên bản ${versionNumber} của dự án “${project.title}”.`,
        href: getProjectNotificationHref("BUSINESS", projectId),
        createdAt: now,
      },
    });
    return { projectTitle: project.title, businessUserId, teamUserIds, awaitingPayment: false };
  }

  const snapshot = readAgreementSnapshot(latest);
  const breakdown = calculateProjectFinancialBreakdown(
    snapshot.totalAmount,
    snapshot.milestones.map(({ paymentPercent }) => paymentPercent),
    businessFeeRate,
    studentFeeRate,
  );
  const currentMilestones = await transaction.milestone.findMany({
    where: { projectId },
    orderBy: { sortOrder: "asc" },
    select: { id: true, sortOrder: true, status: true },
  });
  for (const [index, milestone] of snapshot.milestones.entries()) {
    const data = {
      title: milestone.title,
      description: milestone.description,
      acceptanceCriteria: milestone.acceptanceCriteria,
      paymentPercent: milestone.paymentPercent,
      amount: breakdown.milestones[index]?.grossAmount,
      dueAt: new Date(`${milestone.dueAt}T12:00:00.000Z`),
      sortOrder: index,
      status: "PENDING",
      acceptanceStatus: "NOT_SUBMITTED",
      paymentStatus: "UNFUNDED",
    };
    const existing = currentMilestones[index];
    if (existing) {
      if (existing.status !== "PENDING") {
        throw new Error("Milestone đã thay đổi trước khi xác nhận điều khoản.");
      }
      const updated = await transaction.milestone.updateMany({
        where: { id: existing.id, projectId, status: "PENDING" },
        data,
      });
      if (updated.count !== 1) throw new Error(staleAgreementMessage);
    } else {
      await transaction.milestone.create({ data: { projectId, ...data } });
    }
  }
  const removedIds = currentMilestones
    .slice(snapshot.milestones.length)
    .map(({ id }) => id);
  if (removedIds.length > 0) {
    const removed = await transaction.milestone.deleteMany({
      where: { projectId, id: { in: removedIds }, status: "PENDING" },
    });
    if (removed.count !== removedIds.length) {
      throw new Error("Không thể thay thế danh sách Milestone của phiên bản.");
    }
  }
  const projectChanged = await transaction.project.updateMany({
    where: {
      id: projectId,
      status: "AGREEING",
      legacyTermsExempt: false,
      transactions: { none: { type: "DEPOSIT" } },
    },
    data: {
      title: snapshot.title,
      agreedScope: snapshot.agreedScope,
      deliverables: snapshot.deliverables,
      duration: snapshot.duration,
      totalAmount: snapshot.totalAmount,
      generalAcceptanceCriteria: snapshot.generalAcceptanceCriteria,
      businessResponsibilities: snapshot.businessResponsibilities,
      teamResponsibilities: snapshot.teamResponsibilities,
      paymentMethod: snapshot.paymentMethod,
      status: "AWAITING_PAYMENT",
    },
  });
  if (projectChanged.count !== 1) {
    throw new Error(staleAgreementMessage);
  }

  await transaction.notification.create({
    data: {
      userId: businessUserId,
      dedupeKey: `agreement-response:${projectId}:v${versionNumber}:business`,
      title: "Nhóm đã xác nhận thỏa thuận",
      message: `Nhóm đã xác nhận phiên bản ${versionNumber} của dự án “${project.title}”.`,
      href: getProjectNotificationHref("BUSINESS", projectId),
      createdAt: now,
    },
  });
  const notificationRows = [
    {
      userId: businessUserId,
      dedupeKey: `agreement-awaiting-payment:${projectId}:v${versionNumber}:business`,
      title: "Hai bên đã xác nhận thỏa thuận",
      message: `Phiên bản ${versionNumber} của dự án “${project.title}” đã được hai bên xác nhận. Có thể nạp tiền giả lập.`,
      href: getProjectNotificationHref("BUSINESS", projectId),
      createdAt: now,
    },
    ...teamUserIds.map((userId) => ({
      userId,
      dedupeKey: `agreement-awaiting-payment:${projectId}:v${versionNumber}:${userId}`,
      title: "Hai bên đã xác nhận thỏa thuận",
      message: `Phiên bản ${versionNumber} của dự án “${project.title}” đã được hai bên xác nhận.`,
      href: getProjectNotificationHref("STUDENT", projectId),
      createdAt: now,
    })),
  ];
  await transaction.notification.createMany({ data: notificationRows });
  return { projectTitle: project.title, businessUserId, teamUserIds, awaitingPayment: true };
}

export async function createAgreementVersionNotifications(
  transaction: Prisma.TransactionClient,
  {
    projectId,
    versionNumber,
    title,
    team,
    now = new Date(),
  }: {
    projectId: string;
    versionNumber: number;
    title: string;
    team: {
      ownerId: string | null;
      memberships: { studentProfile: { userId: string } | null }[];
    };
    now?: Date;
  },
): Promise<void> {
  const teamUserIds = [
    ...new Set(
      [team.ownerId, ...team.memberships.map(({ studentProfile }) => studentProfile?.userId)]
        .filter((userId): userId is string => Boolean(userId)),
    ),
  ];
  await transaction.notification.createMany({
    data: teamUserIds.map((userId) => ({
      userId,
      dedupeKey: `agreement-version:${projectId}:v${versionNumber}:${userId}`,
      title: "Doanh nghiệp gửi phiên bản thỏa thuận mới",
      message: `Vui lòng xem và phản hồi phiên bản ${versionNumber} của dự án “${title}”.`,
      href: getProjectNotificationHref("STUDENT", projectId),
      createdAt: now,
    })),
  });
}
