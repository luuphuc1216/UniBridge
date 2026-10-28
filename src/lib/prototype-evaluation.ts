import type { Prisma } from "@/generated/prisma/client";

type Transaction = Prisma.TransactionClient;

export type PrototypeEvaluationClock = { now(): Date };
export const systemPrototypeEvaluationClock: PrototypeEvaluationClock = {
  now: () => new Date(),
};

export const prototypeClosureResults = {
  endedAfterAcceptance: "ENDED_AFTER_ACCEPTANCE",
  endedWithoutSubmission: "ENDED_WITHOUT_SUBMISSION",
} as const;

export type PrototypeEvaluationDecision =
  | "ACCEPTED"
  | "REVISION_REQUESTED"
  | "STOPPED";

export type PrototypeImplementationDecision = "IMPLEMENT" | "ENDED";

export class PrototypeDecisionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrototypeDecisionError";
  }
}

export function parsePrototypeImplementationFormData(formData: FormData): {
  decision: PrototypeImplementationDecision;
  reason: string;
} {
  const decision = formData.get("decision");
  if (decision !== "IMPLEMENT" && decision !== "ENDED") {
    throw new PrototypeDecisionError("Vui lòng chọn quyết định triển khai hợp lệ.");
  }
  const reason = formData.get("reason");
  if (reason !== null && typeof reason !== "string") {
    throw new PrototypeDecisionError("Lý do kết thúc không hợp lệ.");
  }
  return { decision, reason: typeof reason === "string" ? reason : "" };
}

const scoreFields = [
  "problemResponse",
  "feasibility",
  "goalAlignment",
  "practicalImplementation",
  "estimatedCost",
  "implementationTime",
  "valueDelivered",
] as const;

type Scores = Record<(typeof scoreFields)[number], number>;

function validateEvaluation(
  decision: PrototypeEvaluationDecision,
  scores: Scores,
  comment: string,
) {
  if (!["ACCEPTED", "REVISION_REQUESTED", "STOPPED"].includes(decision)) {
    throw new Error("Kết quả đánh giá Prototype không hợp lệ.");
  }
  for (const field of scoreFields) {
    if (!Number.isInteger(scores[field]) || scores[field] < 1 || scores[field] > 5) {
      throw new Error("Mỗi tiêu chí cần được chấm từ 1 đến 5.");
    }
  }
  const trimmedComment = comment.trim();
  if (!trimmedComment || trimmedComment.length > 4000) {
    throw new Error("Nhận xét là bắt buộc và không vượt quá 4.000 ký tự.");
  }
  return trimmedComment;
}

async function findOwnedSelectedApplication(
  transaction: Transaction,
  problemId: string,
  applicationId: string,
  businessUserId: string,
) {
  const application = await transaction.application.findFirst({
    where: {
      id: applicationId,
      problemId,
      status: "SELECTED",
      problem: {
        is: {
          prototypeLegacy: false,
          businessProfile: { is: { userId: businessUserId } },
        },
      },
    },
    select: {
      id: true,
      team: { select: { ownerId: true } },
      problem: {
        select: {
          id: true,
          title: true,
          status: true,
          evaluationResult: true,
          implementationDecision: true,
          prototypeRevisionRequestCount: true,
          trialBriefLockedAt: true,
          businessProfile: { select: { userId: true } },
        },
      },
    },
  });
  return application;
}

export async function evaluatePrototypeProposal(
  transaction: Transaction,
  input: {
    problemId: string;
    applicationId: string;
    proposalId: string;
    businessUserId: string;
    decision: PrototypeEvaluationDecision;
    scores: Scores;
    comment: string;
    clock?: PrototypeEvaluationClock;
  },
) {
  const comment = validateEvaluation(input.decision, input.scores, input.comment);
  const application = await findOwnedSelectedApplication(
    transaction,
    input.problemId,
    input.applicationId,
    input.businessUserId,
  );
  const problem = application?.problem;
  if (!application || !problem) {
    throw new Error("Chỉ doanh nghiệp sở hữu bài toán mới được đánh giá.");
  }
  const teamOwnerId = application.team.ownerId;
  if (!teamOwnerId) {
    throw new Error("Hồ sơ nhóm chưa có chủ nhóm để nhận thông báo.");
  }
  if (
    problem.status !== "EVALUATING" ||
    problem.evaluationResult !== null ||
    problem.implementationDecision !== null ||
    problem.trialBriefLockedAt === null
  ) {
    throw new Error("Bài toán hiện không chờ doanh nghiệp đánh giá Prototype.");
  }

  const proposal = await transaction.proposal.findFirst({
    where: {
      id: input.proposalId,
      applicationId: application.id,
      status: "SUBMITTED",
      handoffStatus: "APPROVED",
    },
    select: { id: true },
  });
  const latestAttempt = proposal
    ? await transaction.proposalSubmissionAttempt.findFirst({
        where: { proposalId: proposal.id },
        orderBy: { attempt: "desc" },
        select: {
          id: true,
          attempt: true,
          handoffReviews: {
            where: { result: "APPROVED" },
            select: { id: true },
            take: 1,
          },
        },
      })
    : null;
  if (!proposal || !latestAttempt?.handoffReviews.length) {
    throw new Error("Chỉ có thể đánh giá lần nộp đã được Admin duyệt bàn giao.");
  }

  let maxRevisionRequests: number | null = null;
  if (input.decision === "REVISION_REQUESTED") {
    const lockedBrief = await transaction.trialBriefVersion.findFirst({
      where: {
        problemId: problem.id,
        lockedAt: { not: null },
      },
      orderBy: { version: "desc" },
      select: { maxRevisionRequests: true },
    });
    if (!lockedBrief) {
      throw new Error("Không tìm thấy hồ sơ thử nghiệm đã khóa.");
    }
    maxRevisionRequests = lockedBrief.maxRevisionRequests;
    if (problem.prototypeRevisionRequestCount >= maxRevisionRequests) {
      throw new Error("Đã hết số lần yêu cầu chỉnh sửa theo hồ sơ thử nghiệm.");
    }
  }

  const now = (input.clock ?? systemPrototypeEvaluationClock).now();
  const problemChanged = await transaction.problem.updateMany({
    where: {
      id: problem.id,
      status: "EVALUATING",
      prototypeLegacy: false,
      evaluationResult: null,
      implementationDecision: null,
      ...(maxRevisionRequests === null
        ? {}
        : { prototypeRevisionRequestCount: { lt: maxRevisionRequests } }),
      applications: {
        some: {
          id: application.id,
          status: "SELECTED",
          proposals: {
            some: {
              id: proposal.id,
              status: "SUBMITTED",
              handoffStatus: "APPROVED",
              submissionAttempts: {
                some: {
                  id: latestAttempt.id,
                  handoffReviews: { some: { result: "APPROVED" } },
                },
              },
            },
          },
        },
      },
      businessProfile: { is: { userId: input.businessUserId } },
    },
    data: {
      status:
        input.decision === "REVISION_REQUESTED"
          ? "PROTOTYPING"
          : input.decision === "STOPPED"
            ? "CLOSED"
            : "EVALUATING",
      evaluationResult: input.decision,
      ...(input.decision === "ACCEPTED"
        ? { implementationDecision: "PENDING" }
        : {}),
      ...(input.decision === "REVISION_REQUESTED"
        ? { prototypeRevisionRequestCount: { increment: 1 } }
        : {}),
    },
  });
  if (problemChanged.count !== 1) {
    throw new Error("Trạng thái bài toán vừa thay đổi. Vui lòng tải lại trang.");
  }

  const legacyProposalStatus =
    input.decision === "REVISION_REQUESTED"
      ? "CHANGES_REQUESTED"
      : input.decision === "STOPPED"
        ? "NOT_IMPLEMENTED"
        : "ACCEPTED";
  const proposalChanged = await transaction.proposal.updateMany({
    where: {
      id: proposal.id,
      applicationId: application.id,
      status: "SUBMITTED",
      handoffStatus: "APPROVED",
    },
    data: { status: legacyProposalStatus },
  });
  if (proposalChanged.count !== 1) {
    throw new Error("Proposal vừa được đánh giá ở tab khác. Vui lòng tải lại trang.");
  }

  const evaluation = await transaction.proposalEvaluation.create({
    data: {
      proposalId: proposal.id,
      ...input.scores,
      comment,
      decision: input.decision,
      evaluationResult: input.decision,
      implementationDecision:
        input.decision === "ACCEPTED" ? "PENDING" : null,
      revisionRequestNumber:
        input.decision === "REVISION_REQUESTED"
          ? problem.prototypeRevisionRequestCount + 1
          : null,
      createdAt: now,
    },
    select: { id: true },
  });
  await transaction.notification.create({
    data: {
      userId: teamOwnerId,
      title:
        input.decision === "ACCEPTED"
          ? "Prototype đã được chấp nhận"
          : input.decision === "REVISION_REQUESTED"
            ? "Doanh nghiệp yêu cầu chỉnh sửa Prototype"
            : "Doanh nghiệp không tiếp tục Prototype",
      message: `Doanh nghiệp đã đánh giá Prototype của bài toán “${problem.title}”.`,
      href: `/student/workspace/${problem.id}?applicationId=${application.id}`,
      dedupeKey: `prototype-evaluation-${evaluation.id}-${teamOwnerId}`,
      createdAt: now,
    },
  });
  return evaluation;
}

export async function decidePrototypeImplementation(
  transaction: Transaction,
  input: {
    problemId: string;
    applicationId: string;
    businessUserId: string;
    decision: PrototypeImplementationDecision;
    reason?: string;
    clock?: PrototypeEvaluationClock;
  },
) {
  if (input.decision !== "IMPLEMENT" && input.decision !== "ENDED") {
    throw new PrototypeDecisionError("Quyết định triển khai không hợp lệ.");
  }
  const reason = input.reason?.trim() ?? "";
  if (input.decision === "ENDED" && (!reason || reason.length > 4000)) {
    throw new PrototypeDecisionError("Vui lòng ghi lý do kết thúc (tối đa 4.000 ký tự).");
  }
  const application = await findOwnedSelectedApplication(
    transaction,
    input.problemId,
    input.applicationId,
    input.businessUserId,
  );
  const problem = application?.problem;
  if (!application || !problem) {
    throw new PrototypeDecisionError("Không tìm thấy bài toán hoặc hồ sơ ứng tuyển được phép xử lý.");
  }
  const teamOwnerId = application.team.ownerId;
  if (!teamOwnerId) {
    throw new PrototypeDecisionError("Hồ sơ nhóm chưa có chủ nhóm để nhận thông báo.");
  }
  const acceptedEvaluation = await transaction.proposalEvaluation.findFirst({
    where: {
      evaluationResult: "ACCEPTED",
      proposal: { is: { applicationId: application.id } },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, implementationDecision: true },
  });
  if (!acceptedEvaluation) {
    throw new PrototypeDecisionError("Chưa có đánh giá được chấp nhận để quyết định.");
  }
  if (acceptedEvaluation.implementationDecision !== problem.implementationDecision) {
    throw new PrototypeDecisionError("Dữ liệu quyết định không nhất quán, liên hệ quản trị");
  }
  if (
    problem.implementationDecision === "IMPLEMENT" ||
    problem.implementationDecision === "ENDED"
  ) {
    throw new PrototypeDecisionError("Quyết định đã được lưu trước đó.");
  }
  if (
    problem.status !== "EVALUATING" ||
    problem.evaluationResult !== "ACCEPTED" ||
    problem.implementationDecision !== "PENDING" ||
    acceptedEvaluation.implementationDecision !== "PENDING"
  ) {
    throw new PrototypeDecisionError("Dữ liệu quyết định không nhất quán, liên hệ quản trị");
  }

  const now = (input.clock ?? systemPrototypeEvaluationClock).now();
  const nextStatus =
    input.decision === "IMPLEMENT" ? "READY_FOR_IMPLEMENTATION" : "CLOSED";
  const changed = await transaction.problem.updateMany({
    where: {
      id: problem.id,
      status: "EVALUATING",
      prototypeLegacy: false,
      evaluationResult: "ACCEPTED",
      implementationDecision: "PENDING",
      applications: { some: { id: application.id, status: "SELECTED" } },
      businessProfile: { is: { userId: input.businessUserId } },
    },
    data: {
      status: nextStatus,
      implementationDecision: input.decision,
    },
  });
  if (changed.count !== 1) {
    throw new PrototypeDecisionError("Quyết định đã được lưu trước đó.");
  }
  const evaluationChanged = await transaction.proposalEvaluation.updateMany({
    where: {
      id: acceptedEvaluation.id,
      evaluationResult: "ACCEPTED",
      implementationDecision: "PENDING",
    },
    data: { implementationDecision: input.decision },
  });
  if (evaluationChanged.count !== 1) {
    throw new PrototypeDecisionError("Dữ liệu quyết định không nhất quán, liên hệ quản trị");
  }

  if (input.decision === "ENDED") {
    await transaction.prototypeClosure.create({
      data: {
        problemId: problem.id,
        actorId: input.businessUserId,
        reason,
        result: prototypeClosureResults.endedAfterAcceptance,
        createdAt: now,
      },
    });
  }
  await transaction.notification.create({
    data: {
      userId: teamOwnerId,
      title:
        input.decision === "IMPLEMENT"
          ? "Doanh nghiệp muốn tạo thỏa thuận triển khai"
          : "Doanh nghiệp đã kết thúc sau khi chấp nhận Prototype",
      message:
        input.decision === "IMPLEMENT"
          ? `Doanh nghiệp mở cổng soạn thỏa thuận cho bài toán “${problem.title}”.`
          : `Doanh nghiệp đã kết thúc giai đoạn Prototype của bài toán “${problem.title}”.`,
      href: `/student/workspace/${problem.id}?applicationId=${application.id}`,
      dedupeKey: `prototype-implementation-${problem.id}-${input.decision}`,
      createdAt: now,
    },
  });
}

export async function closePrototypeWithoutSubmission(
  transaction: Transaction,
  input: {
    problemId: string;
    applicationId: string;
    businessUserId: string;
    reason: string;
    clock?: PrototypeEvaluationClock;
  },
) {
  const reason = input.reason.trim();
  if (!reason || reason.length > 4000) {
    throw new Error("Vui lòng ghi lý do kết thúc (tối đa 4.000 ký tự).");
  }
  const application = await findOwnedSelectedApplication(
    transaction,
    input.problemId,
    input.applicationId,
    input.businessUserId,
  );
  const problem = application?.problem;
  if (!application || !problem || problem.status !== "PROTOTYPING") {
    throw new Error("Chỉ có thể kết thúc khi bài toán đang ở giai đoạn Prototype.");
  }
  const teamOwnerId = application.team.ownerId;
  if (!teamOwnerId) {
    throw new Error("Hồ sơ nhóm chưa có chủ nhóm để nhận thông báo.");
  }

  const now = (input.clock ?? systemPrototypeEvaluationClock).now();
  const changed = await transaction.problem.updateMany({
    where: {
      id: problem.id,
      status: "PROTOTYPING",
      prototypeLegacy: false,
      applications: {
        some: {
          id: application.id,
          status: "SELECTED",
          proposals: { none: { handoffStatus: "PENDING_REVIEW" } },
        },
      },
      businessProfile: { is: { userId: input.businessUserId } },
    },
    data: { status: "CLOSED" },
  });
  if (changed.count !== 1) {
    throw new Error("Không thể kết thúc khi đang có lần nộp chờ Admin kiểm tra.");
  }

  await transaction.prototypeClosure.create({
    data: {
      problemId: problem.id,
      actorId: input.businessUserId,
      reason,
      result: prototypeClosureResults.endedWithoutSubmission,
      createdAt: now,
    },
  });
  await transaction.notification.create({
    data: {
      userId: teamOwnerId,
      title: "Doanh nghiệp kết thúc giai đoạn Prototype",
      message: `Doanh nghiệp đã kết thúc giai đoạn Prototype của bài toán “${problem.title}” do chưa nhận được lần nộp đang chờ kiểm tra.`,
      href: `/student/workspace/${problem.id}?applicationId=${application.id}`,
      dedupeKey: `prototype-closure-${problem.id}-${prototypeClosureResults.endedWithoutSubmission}`,
      createdAt: now,
    },
  });
}
