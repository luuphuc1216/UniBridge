import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { AttachmentStorage } from "@/lib/storage/attachment-storage";
import { isAdminRole } from "@/lib/admin-access";

type Transaction = Prisma.TransactionClient;

export type ProposalHandoffClock = { now(): Date };
export const systemProposalHandoffClock: ProposalHandoffClock = {
  now: () => new Date(),
};

export type ProposalHandoffFile = {
  originalName: string;
  contentType: string;
  sizeBytes: number;
  content: Uint8Array;
};

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

async function submitInTransaction(
  transaction: Transaction,
  {
    applicationId,
    proposalId,
    submitterId,
    type,
    description,
    files,
    storageKeys,
    now,
  }: {
    applicationId: string;
    proposalId: string | null;
    submitterId: string;
    type: string;
    description: string;
    files: ProposalHandoffFile[];
    storageKeys: string[];
    now: Date;
  },
) {
  const application = await transaction.application.findFirst({
    where: {
      id: applicationId,
      status: "SELECTED",
      team: { is: { ownerId: submitterId } },
      problem: {
        is: {
          status: "PROTOTYPING",
          prototypeLegacy: false,
          trialBriefLockedAt: { not: null },
        },
      },
    },
    include: {
      team: { select: { ownerId: true } },
      problem: {
        select: {
          id: true,
          title: true,
          status: true,
          evaluationResult: true,
          businessProfile: { select: { userId: true } },
        },
      },
    },
  });
  if (!application) {
    throw new Error(
      "Chỉ chủ nhóm được chọn mới có thể nộp Proposal khi hồ sơ thử nghiệm đã khóa và bài toán đang xây dựng.",
    );
  }

  const pendingProposal = await transaction.proposal.findFirst({
    where: {
      applicationId,
      handoffStatus: "PENDING_REVIEW",
    },
    select: { id: true },
  });
  const approvedProposal = await transaction.proposal.findFirst({
    where: { applicationId, handoffStatus: "APPROVED" },
    orderBy: { version: "desc" },
    select: {
      id: true,
      evaluations: {
        where: { evaluationResult: "REVISION_REQUESTED" },
        select: { id: true },
        take: 1,
      },
    },
  });
  const resubmittingAfterRevision =
    application.problem.evaluationResult === "REVISION_REQUESTED" &&
    Boolean(approvedProposal?.evaluations.length);
  if (
    pendingProposal ||
    (approvedProposal && !resubmittingAfterRevision)
  ) {
    throw new Error("Proposal đang chờ kiểm tra hoặc đã được duyệt bàn giao.");
  }
  const problemStillWritable = await transaction.problem.updateMany({
    where: {
      id: application.problem.id,
      status: "PROTOTYPING",
      prototypeLegacy: false,
      trialBriefLockedAt: { not: null },
      ...(resubmittingAfterRevision
        ? { evaluationResult: "REVISION_REQUESTED" }
        : {}),
      applications: { some: { id: applicationId, status: "SELECTED" } },
    },
    data: { updatedAt: now },
  });
  if (problemStillWritable.count !== 1) {
    throw new Error("Bài toán vừa thay đổi trạng thái. Vui lòng tải lại trang.");
  }

  let proposalIdToSubmit = proposalId;
  if (proposalIdToSubmit) {
    const resubmittableStatuses = resubmittingAfterRevision
      ? ["RETURNED", "APPROVED"]
      : ["RETURNED"];
    const returnedProposal = await transaction.proposal.findFirst({
      where: {
        id: proposalIdToSubmit,
        applicationId,
        handoffStatus: { in: resubmittableStatuses },
      },
      select: { id: true, type: true },
    });
    if (!returnedProposal) {
      throw new Error("Chỉ có thể nộp lại Proposal đã được Admin trả về.");
    }
    if (returnedProposal.type !== type) {
      throw new Error("Không thể đổi loại Proposal khi nộp lại cùng phiên bản.");
    }
  } else {
    const latestProposal = await transaction.proposal.findFirst({
      where: { applicationId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const version = (latestProposal?.version ?? 0) + 1;
    const proposal = await transaction.proposal.create({
      data: {
        applicationId,
        version,
        type,
        description,
        status: "DRAFT",
        submissionStatus: "SUBMITTED",
        handoffStatus: "PENDING_REVIEW",
        submittedByUserId: submitterId,
        submittedAt: now,
        lastResubmittedAt: now,
      },
      select: { id: true },
    });
    proposalIdToSubmit = proposal.id;
  }

  if (proposalId) {
    const resubmittableStatuses = resubmittingAfterRevision
      ? ["RETURNED", "APPROVED"]
      : ["RETURNED"];
    const changed = await transaction.proposal.updateMany({
      where: {
        id: proposalId,
        applicationId,
        handoffStatus: { in: resubmittableStatuses },
        application: {
          is: {
            status: "SELECTED",
            problem: {
              is: {
                id: application.problem.id,
                status: "PROTOTYPING",
                prototypeLegacy: false,
                trialBriefLockedAt: { not: null },
                ...(resubmittingAfterRevision
                  ? { evaluationResult: "REVISION_REQUESTED" }
                  : {}),
              },
            },
          },
        },
      },
      data: {
        status: "SUBMITTED",
        submissionStatus: "SUBMITTED",
        handoffStatus: "PENDING_REVIEW",
        submittedByUserId: submitterId,
        submittedAt: now,
        lastResubmittedAt: now,
      },
    });
    if (changed.count !== 1) {
      throw new Error("Proposal vừa được cập nhật ở tab khác. Vui lòng tải lại trang.");
    }
  }

  if (!proposalIdToSubmit) {
    throw new Error("Không thể xác định Proposal cần nộp.");
  }
  const latestAttempt = await transaction.proposalSubmissionAttempt.findFirst({
    where: { proposalId: proposalIdToSubmit },
    orderBy: { attempt: "desc" },
    select: { attempt: true },
  });
  const attempt = await transaction.proposalSubmissionAttempt.create({
    data: {
      proposalId: proposalIdToSubmit,
      attempt: (latestAttempt?.attempt ?? 0) + 1,
      submittedByUserId: submitterId,
      description,
      submittedAt: now,
    },
    select: { id: true, attempt: true },
  });
  if (files.length > 0) {
    await transaction.proposalFile.createMany({
      data: files.map((file, index) => ({
        proposalId: proposalIdToSubmit,
        attemptId: attempt.id,
        originalName: file.originalName,
        contentType: file.contentType,
        sizeBytes: file.sizeBytes,
        storageKey: storageKeys[index],
      })),
    });
  }

  const administrators = await transaction.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
  });
  await transaction.notification.createMany({
    data: administrators.map(({ id }) => ({
      userId: id,
      title: "Có Proposal cần kiểm tra bàn giao",
      message: `Nhóm đã nộp lần ${attempt.attempt} cho bài toán “${application.problem.title}”.`,
      href: `/admin/prototype-handoffs/${attempt.id}`,
      dedupeKey: `proposal-handoff-pending-${attempt.id}-${id}`,
      createdAt: now,
    })),
  });

  return { proposalId: proposalIdToSubmit, attemptId: attempt.id };
}

export async function submitPrototypeProposal({
  database,
  storage,
  applicationId,
  proposalId = null,
  submitterId,
  type,
  description,
  files,
  clock = systemProposalHandoffClock,
}: {
  database: PrismaClient;
  storage: AttachmentStorage;
  applicationId: string;
  proposalId?: string | null;
  submitterId: string;
  type: string;
  description: string;
  files: ProposalHandoffFile[];
  clock?: ProposalHandoffClock;
}) {
  const storageKeys: string[] = [];
  try {
    for (const file of files) {
      const storageKey = randomUUID();
      storageKeys.push(storageKey);
      await storage.save(storageKey, file.content);
    }

    const now = clock.now();
    return await database.$transaction((transaction) =>
      submitInTransaction(transaction, {
        applicationId,
        proposalId,
        submitterId,
        type,
        description,
        files,
        storageKeys,
        now,
      }),
    );
  } catch (error) {
    const cleanupResults = await Promise.allSettled(
      storageKeys.map((storageKey) => storage.delete(storageKey)),
    );
    const cleanupErrors = cleanupResults.flatMap((result) =>
      result.status === "rejected" ? [result.reason] : [],
    );
    if (cleanupErrors.length > 0) {
      console.error("Không thể dọn một hoặc nhiều tệp Proposal sau lỗi nộp:", cleanupErrors);
      throw new Error(
        "Nộp Proposal thất bại và không thể xóa toàn bộ tệp vừa tải lên. Vui lòng liên hệ quản trị viên.",
      );
    }
    if (isUniqueConstraintError(error) || isSqliteConcurrencyError(error)) {
      throw new Error("Proposal vừa được cập nhật ở tab khác. Vui lòng tải lại trang.");
    }
    throw error;
  }
}

export type ProposalHandoffReviewInput = {
  attemptId: string;
  reviewerId: string;
  reviewerRole: string;
  decision: "APPROVED" | "RETURNED";
  filesOrLinksComplete: boolean;
  withinTrialBriefScope: boolean;
  compliesWithRules: boolean;
  note: string;
  missingItems?: string[];
  clock?: ProposalHandoffClock;
};

function validateReviewInput(input: ProposalHandoffReviewInput) {
  if (
    typeof input.filesOrLinksComplete !== "boolean" ||
    typeof input.withinTrialBriefScope !== "boolean" ||
    typeof input.compliesWithRules !== "boolean"
  ) {
    throw new Error("Vui lòng hoàn tất cả ba mục kiểm tra bàn giao.");
  }
  const note = input.note.trim();
  if (!note || note.length > 4000) {
    throw new Error("Ghi chú kiểm tra là bắt buộc và không vượt quá 4.000 ký tự.");
  }
  const missingItems = (input.missingItems ?? [])
    .map((item) => item.trim())
    .filter(Boolean);
  const allPassed =
    input.filesOrLinksComplete &&
    input.withinTrialBriefScope &&
    input.compliesWithRules;
  if ((input.decision === "APPROVED") !== allPassed) {
    throw new Error(
      "Chọn kết quả đạt khi cả ba mục đạt; nếu không đạt, cần có ít nhất một mục chưa đạt.",
    );
  }
  if (allPassed && missingItems.length > 0) {
    throw new Error("Không ghi mục cần bổ sung khi cả ba mục đều đạt.");
  }
  if (!allPassed && missingItems.length === 0) {
    throw new Error("Khi bàn giao chưa đạt, vui lòng nêu ít nhất một mục cần bổ sung.");
  }
  return { note, missingItems, allPassed };
}

export async function reviewProposalHandoff(
  transaction: Transaction,
  input: ProposalHandoffReviewInput,
) {
  if (!isAdminRole(input.reviewerRole)) {
    throw new Error("Chỉ quản trị viên mới được kiểm tra bàn giao Proposal.");
  }
  const { note, missingItems, allPassed } = validateReviewInput(input);
  const now = (input.clock ?? systemProposalHandoffClock).now();
  const attempt = await transaction.proposalSubmissionAttempt.findUnique({
    where: { id: input.attemptId },
    include: {
      proposal: {
        include: {
          application: {
            include: {
              problem: {
                select: {
                  id: true,
                  title: true,
                  status: true,
                  prototypeLegacy: true,
                  trialBriefLockedAt: true,
                  businessProfile: { select: { userId: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!attempt) {
    throw new Error("Không tìm thấy lần nộp Proposal.");
  }
  const { proposal } = attempt;
  const { application } = proposal;
  const problem = application.problem;
  const latestAttempt = await transaction.proposalSubmissionAttempt.findFirst({
    where: { proposalId: proposal.id },
    orderBy: { attempt: "desc" },
    select: { id: true },
  });
  if (
    proposal.handoffStatus !== "PENDING_REVIEW" ||
    latestAttempt?.id !== attempt.id ||
    problem.status !== "PROTOTYPING" ||
    problem.prototypeLegacy ||
    problem.trialBriefLockedAt === null ||
    application.status !== "SELECTED"
  ) {
    throw new Error("Lần nộp này không còn chờ kiểm tra bàn giao.");
  }

  const proposalChanged = await transaction.proposal.updateMany({
    where: {
      id: proposal.id,
      applicationId: application.id,
      handoffStatus: "PENDING_REVIEW",
      submissionAttempts: {
        some: { id: attempt.id, attempt: attempt.attempt },
        none: { attempt: { gt: attempt.attempt } },
      },
      application: {
        is: {
          status: "SELECTED",
          problem: {
            is: {
              id: problem.id,
              status: "PROTOTYPING",
              prototypeLegacy: false,
              trialBriefLockedAt: { not: null },
            },
          },
        },
      },
    },
    data: allPassed
      ? { handoffStatus: "APPROVED", status: "SUBMITTED" }
      : { handoffStatus: "RETURNED" },
  });
  if (proposalChanged.count !== 1) {
    throw new Error("Lần nộp vừa được xử lý ở tab khác. Vui lòng tải lại trang.");
  }

  if (allPassed) {
    const problemChanged = await transaction.problem.updateMany({
      where: {
        id: problem.id,
        status: "PROTOTYPING",
        prototypeLegacy: false,
        trialBriefLockedAt: { not: null },
        applications: { some: { id: application.id, status: "SELECTED" } },
      },
      data: { status: "EVALUATING", evaluationResult: null },
    });
    if (problemChanged.count !== 1) {
      throw new Error("Trạng thái bài toán vừa thay đổi. Vui lòng tải lại trang.");
    }
  }

  await transaction.proposalHandoffReview.create({
    data: {
      problemId: problem.id,
      proposalId: proposal.id,
      attemptId: attempt.id,
      reviewedByUserId: input.reviewerId,
      filesOrLinksComplete: input.filesOrLinksComplete,
      withinTrialBriefScope: input.withinTrialBriefScope,
      compliesWithRules: input.compliesWithRules,
      note,
      missingItems: missingItems.length ? missingItems.join("\n") : null,
      result: allPassed ? "APPROVED" : "RETURNED",
      createdAt: now,
    },
  });

  if (allPassed) {
    await transaction.notification.create({
      data: {
        userId: application.problem.businessProfile.userId,
        title: "Proposal đã qua kiểm tra bàn giao",
        message: `Proposal của bài toán “${application.problem.title}” đã được chuyển cho doanh nghiệp đánh giá.`,
        href: `/business/problems/${problem.id}/workspace?applicationId=${application.id}`,
        dedupeKey: `proposal-handoff-approved-${attempt.id}`,
        createdAt: now,
      },
    });
  } else {
    const ownerId = await transaction.studentTeam.findUnique({
      where: { id: application.teamId },
      select: { ownerId: true },
    });
    if (!ownerId?.ownerId) {
      throw new Error("Không tìm thấy chủ nhóm để gửi kết quả kiểm tra bàn giao.");
    }
    await transaction.notification.create({
      data: {
        userId: ownerId.ownerId,
        title: "Proposal cần bổ sung trước khi chuyển cho doanh nghiệp",
        message: `Cần bổ sung: ${missingItems.join("; ")}`,
        href: `/student/workspace/${problem.id}?applicationId=${application.id}`,
        dedupeKey: `proposal-handoff-returned-${attempt.id}`,
        createdAt: now,
      },
    });
  }

  return { result: allPassed ? "APPROVED" : "RETURNED" };
}
