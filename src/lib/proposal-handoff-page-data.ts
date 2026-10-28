import type { PrismaClient } from "@/generated/prisma/client";
import { isAdminRole } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";

type HandoffPageDatabase = Pick<PrismaClient, "proposalSubmissionAttempt">;

export async function getProposalHandoffPageData(
  attemptId: string,
  role: string,
  database: HandoffPageDatabase = prisma,
) {
  if (!isAdminRole(role)) {
    throw new Error("Chỉ quản trị viên mới được xem kết quả kiểm tra bàn giao.");
  }

  const attempt = await database.proposalSubmissionAttempt.findUnique({
    where: { id: attemptId },
    include: {
      files: { orderBy: { createdAt: "asc" } },
      handoffReviews: {
        orderBy: { createdAt: "desc" },
        include: { reviewedBy: { select: { id: true, name: true } } },
      },
      proposal: {
        include: {
          submissionAttempts: {
            orderBy: { attempt: "desc" },
            take: 1,
            select: { id: true, attempt: true },
          },
          application: {
            include: {
              team: { select: { name: true } },
              problem: {
                select: {
                  id: true,
                  title: true,
                  status: true,
                  prototypeLegacy: true,
                  businessProfile: { select: { companyName: true } },
                  trialBriefVersions: {
                    where: { lockedAt: { not: null } },
                    orderBy: { version: "desc" },
                    take: 1,
                    select: { objective: true, scope: true, deliverables: true, deadline: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!attempt) return { kind: "not-found" as const };

  const latestAttempt = attempt.proposal.submissionAttempts[0];
  if (latestAttempt && latestAttempt.id !== attempt.id) {
    return {
      kind: "superseded" as const,
      attempt,
      latestAttempt,
    };
  }

  if (
    attempt.proposal.handoffStatus === "PENDING_REVIEW" &&
    attempt.proposal.application.problem.status === "PROTOTYPING" &&
    !attempt.proposal.application.problem.prototypeLegacy
  ) {
    return { kind: "pending" as const, attempt };
  }

  return {
    kind: "processed" as const,
    attempt,
    review: attempt.handoffReviews[0] ?? null,
  };
}
