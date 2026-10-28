import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

type ProposalFileDatabase = Pick<PrismaClient, "proposalFile">;

export type ProposalFileAccessContext = {
  role: string;
  userId: string;
  applicationStatus: string;
  teamOwnerId: string | null;
  teamMemberUserIds: string[];
  businessUserId: string;
  prototypeLegacy: boolean;
  proposalHandoffStatus: string;
  attemptId: string | null;
  attemptReviewResults: string[];
};

export function canReadProposalFile(context: ProposalFileAccessContext): boolean {
  if (context.role === "ADMIN") return true;
  if (context.applicationStatus !== "SELECTED") return false;
  if (
    context.role === "STUDENT" &&
    (context.teamOwnerId === context.userId ||
      context.teamMemberUserIds.includes(context.userId))
  ) {
    return true;
  }
  if (
    context.role !== "BUSINESS" ||
    context.businessUserId !== context.userId
  ) {
    return false;
  }
  if (context.prototypeLegacy) return true;
  return (
    context.proposalHandoffStatus === "APPROVED" &&
    context.attemptId !== null &&
    context.attemptReviewResults.includes("APPROVED")
  );
}

export async function findAuthorizedProposalFile(
  fileId: string,
  userId: string,
  role: string,
  database: ProposalFileDatabase = prisma,
) {
  const file = await database.proposalFile.findUnique({
    where: { id: fileId },
    include: {
      proposal: {
        include: {
          application: {
            include: {
              team: {
                select: {
                  ownerId: true,
                  memberships: {
                    select: { studentProfile: { select: { userId: true } } },
                  },
                },
              },
              problem: {
                select: {
                  prototypeLegacy: true,
                  businessProfile: { select: { userId: true } },
                },
              },
            },
          },
        },
      },
      attempt: {
        include: {
          handoffReviews: { select: { result: true } },
        },
      },
    },
  });
  if (!file) return null;

  const { application } = file.proposal;
  const { problem } = application;
  const allowed = canReadProposalFile({
    role,
    userId,
    applicationStatus: application.status,
    teamOwnerId: application.team.ownerId,
    teamMemberUserIds: application.team.memberships.flatMap(({ studentProfile }) =>
      studentProfile ? [studentProfile.userId] : [],
    ),
    businessUserId: problem.businessProfile.userId,
    prototypeLegacy: problem.prototypeLegacy,
    proposalHandoffStatus: file.proposal.handoffStatus,
    attemptId: file.attemptId,
    attemptReviewResults: file.attempt?.handoffReviews.map(({ result }) => result) ?? [],
  });
  return allowed ? file : null;
}
