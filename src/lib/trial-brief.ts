import type { Prisma } from "@/generated/prisma/client";
import { TRIAL_BRIEF_CONFIG } from "./trial-brief-config";
import { canRespondForTeam } from "./team-permissions";

type Transaction = Prisma.TransactionClient;

export type TrialBriefClock = { now(): Date };
export const systemTrialBriefClock: TrialBriefClock = { now: () => new Date() };

export type TrialBriefInput = {
  objective: string;
  scope: string;
  deliverables: string;
  deadline: Date;
  evaluationCriteria: string;
  maxRevisionRequests: number;
  businessProvidedData: string;
  confidentialityTerms: string;
  ownershipTerms: string;
  compensationTerms: string;
};

function assertText(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} là bắt buộc.`);
  return normalized;
}

export function validateTrialBriefInput(input: TrialBriefInput, now = new Date()): TrialBriefInput {
  const maxRevisionRequests = input.maxRevisionRequests;
  if (
    !Number.isInteger(maxRevisionRequests) ||
    maxRevisionRequests < TRIAL_BRIEF_CONFIG.minMaxRevisionRequests ||
    maxRevisionRequests > TRIAL_BRIEF_CONFIG.maxMaxRevisionRequests
  ) {
    throw new Error(
      `Số lần chỉnh sửa tối đa phải từ ${TRIAL_BRIEF_CONFIG.minMaxRevisionRequests} đến ${TRIAL_BRIEF_CONFIG.maxMaxRevisionRequests}.`,
    );
  }
  if (!(input.deadline instanceof Date) || Number.isNaN(input.deadline.valueOf()) || input.deadline <= now) {
    throw new Error("Thời hạn phải là một thời điểm trong tương lai.");
  }
  return {
    objective: assertText(input.objective, "Mục tiêu"),
    scope: assertText(input.scope, "Phạm vi"),
    deliverables: assertText(input.deliverables, "Sản phẩm đầu ra"),
    deadline: input.deadline,
    evaluationCriteria: assertText(input.evaluationCriteria, "Tiêu chí đánh giá"),
    maxRevisionRequests,
    businessProvidedData: input.businessProvidedData.trim(),
    confidentialityTerms: assertText(input.confidentialityTerms, "Yêu cầu bảo mật"),
    ownershipTerms: assertText(input.ownershipTerms, "Quyền sở hữu/sử dụng"),
    compensationTerms: input.compensationTerms.trim(),
  };
}

function teamRecipientIds(application: {
  team: {
    ownerId: string | null;
  };
}): string[] {
  return application.team.ownerId ? [application.team.ownerId] : [];
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

function isSqliteConcurrencyError(error: unknown): boolean {
  return error instanceof Error && /busy|locked/i.test(error.message);
}

function isBriefConcurrencyError(error: unknown): boolean {
  return isUniqueConstraintError(error) || isSqliteConcurrencyError(error);
}

const BRIEF_CONCURRENCY_MESSAGE = "Hồ sơ vừa được cập nhật, vui lòng tải lại";

async function findSelectedWorkspace(transaction: Transaction, problemId: string) {
  return transaction.problem.findFirst({
    where: {
      id: problemId,
      status: "TEAM_SELECTED",
      trialBriefLockedAt: null,
      applications: { some: { status: "SELECTED" } },
    },
    include: {
      businessProfile: { select: { userId: true } },
      trialBriefVersions: {
        orderBy: { version: "desc" },
        take: 1,
        include: { responses: true },
      },
      applications: {
        where: { status: "SELECTED" },
        take: 1,
        include: {
          team: {
            select: {
              ownerId: true,
            },
          },
        },
      },
    },
  });
}

export async function createTrialBriefVersion(
  transaction: Transaction,
  {
    problemId,
    businessUserId,
    input,
    clock = systemTrialBriefClock,
  }: {
    problemId: string;
    businessUserId: string;
    input: TrialBriefInput;
    clock?: TrialBriefClock;
  },
) {
  try {
    const now = clock.now();
    const reserved = await transaction.problem.updateMany({
      where: { id: problemId, status: "TEAM_SELECTED", trialBriefLockedAt: null },
      data: { updatedAt: now },
    });
    if (reserved.count !== 1) {
      throw new Error("Bài toán không còn chờ hồ sơ thử nghiệm.");
    }
    const validInput = validateTrialBriefInput(input, now);
    const workspace = await findSelectedWorkspace(transaction, problemId);
    if (!workspace || workspace.businessProfile.userId !== businessUserId) {
      throw new Error("Bạn không có quyền soạn hồ sơ cho bài toán này.");
    }
    const latestVersion = workspace.trialBriefVersions[0];
    const version = (latestVersion?.version ?? 0) + 1;
    const brief = await transaction.trialBriefVersion.create({
      data: {
        problemId,
        version,
        ...validInput,
        createdByUserId: businessUserId,
        responses: {
          create: {
            party: "BUSINESS",
            decision: "CONFIRMED",
            respondedByUserId: businessUserId,
          },
        },
      },
      include: { responses: true },
    });
    const application = workspace.applications[0];
    if (application) {
      await transaction.notification.createMany({
        data: [...new Set(teamRecipientIds(application))].map((userId) => ({
          userId,
          title: "Có hồ sơ thử nghiệm mới",
          message: `Doanh nghiệp đã gửi hồ sơ thử nghiệm phiên bản ${version}. Vui lòng xem và phản hồi.`,
          href: `/student/workspace/${problemId}?applicationId=${application.id}`,
          dedupeKey: `trial-brief-version-${brief.id}-${userId}`,
        })),
      });
    }
    return brief;
  } catch (error) {
    if (isBriefConcurrencyError(error)) {
      throw new Error(BRIEF_CONCURRENCY_MESSAGE);
    }
    throw error;
  }
}

export async function respondToTrialBrief(
  transaction: Transaction,
  {
    problemId,
    version,
    studentUserId,
    decision,
    note,
    clock = systemTrialBriefClock,
  }: {
    problemId: string;
    version: number;
    studentUserId: string;
    decision: "CONFIRMED" | "REVISION_REQUESTED";
    note?: string;
    clock?: TrialBriefClock;
  },
) {
  const normalizedNote = note?.trim() ?? "";
  if (decision === "REVISION_REQUESTED" && !normalizedNote) {
    throw new Error("Vui lòng ghi chú nội dung cần điều chỉnh.");
  }
  try {
    const now = clock.now();
    const reserved = await transaction.problem.updateMany({
      where: { id: problemId, status: "TEAM_SELECTED", trialBriefLockedAt: null },
      data: { updatedAt: now },
    });
    if (reserved.count !== 1) {
      throw new Error("Hồ sơ đã được cập nhật hoặc khóa, vui lòng tải lại");
    }
    const workspace = await findSelectedWorkspace(transaction, problemId);
    const application = workspace?.applications[0];
    if (!workspace || !application) {
      throw new Error("Bài toán không còn chờ xác nhận hồ sơ thử nghiệm.");
    }
    if (!canRespondForTeam(application.team.ownerId, studentUserId)) {
      throw new Error("Chỉ chủ nhóm mới được phản hồi hồ sơ.");
    }
    const latestVersion = workspace.trialBriefVersions[0];
    if (!latestVersion || latestVersion.version !== version) {
      throw new Error("Hồ sơ bạn đang phản hồi không còn là phiên bản mới nhất. Vui lòng tải lại trang.");
    }
    const response = await transaction.trialBriefResponse.create({
      data: {
        trialBriefVersionId: latestVersion.id,
        party: "STUDENT",
        decision,
        note: normalizedNote || null,
        respondedByUserId: studentUserId,
      },
    });
    if (decision === "REVISION_REQUESTED") {
      await transaction.notification.create({
        data: {
          userId: workspace.businessProfile.userId,
          title: "Nhóm đề nghị điều chỉnh hồ sơ thử nghiệm",
          message: `Nhóm đã đề nghị điều chỉnh hồ sơ phiên bản ${version}: ${normalizedNote}`,
          href: `/business/problems/${problemId}/workspace`,
          dedupeKey: `trial-brief-revision-${response.id}`,
        },
      });
      return response;
    }

    const changed = await transaction.problem.updateMany({
      where: {
        id: problemId,
        status: "TEAM_SELECTED",
        trialBriefLockedAt: null,
        trialBriefVersions: { some: { id: latestVersion.id, version } },
      },
      data: {
        status: "PROTOTYPING",
        trialBriefLockedAt: clock.now(),
      },
    });
    if (changed.count !== 1) {
      throw new Error("Hồ sơ đã được xác nhận hoặc khóa ở tab khác. Vui lòng tải lại trang.");
    }
    await transaction.trialBriefVersion.update({
      where: { id: latestVersion.id },
      data: { lockedAt: clock.now() },
    });
    const recipients = [
      workspace.businessProfile.userId,
      ...teamRecipientIds(application),
    ];
    await transaction.notification.createMany({
      data: [...new Set(recipients)].map((userId) => ({
        userId,
        title: "Hồ sơ thử nghiệm đã được xác nhận",
        message: `Hai bên đã xác nhận hồ sơ phiên bản ${version}. Bài toán bắt đầu giai đoạn Prototype.`,
        href: userId === workspace.businessProfile.userId
          ? `/business/problems/${problemId}/workspace`
          : `/student/workspace/${problemId}?applicationId=${application.id}`,
        dedupeKey: `trial-brief-locked-${latestVersion.id}-${userId}`,
      })),
    });
    return response;
  } catch (error) {
    if (isBriefConcurrencyError(error)) {
      throw new Error(BRIEF_CONCURRENCY_MESSAGE);
    }
    throw error;
  }
}
