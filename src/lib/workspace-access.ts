import { prisma } from "@/lib/prisma";
import {
  isWorkspaceMessageWritableApplicationStatus,
} from "@/lib/problem-workflow";

export async function findAuthorizedWorkspace(
  problemId: string,
  userId: string,
  role: string,
  applicationId?: string,
) {
  const problem = await prisma.problem.findFirst({
    where: {
      id: problemId,
      status: {
        in: [
          "APPROVED",
          "PUBLISHED",
          "TEAM_SELECTED",
          "PROTOTYPING",
          "EVALUATING",
          "CLOSED",
          "READY_FOR_IMPLEMENTATION",
          "COMPLETED",
        ],
      },
      applications: {
        some: {
          ...(applicationId ? { id: applicationId } : {}),
          status: { in: ["PENDING_CONFIRMATION", "SELECTED"] },
          ...(role === "STUDENT"
            ? {
                team: {
                  OR: [
                    { ownerId: userId },
                    { memberships: { some: { studentProfile: { userId } } } },
                  ],
                },
              }
            : {}),
        },
      },
      ...(role === "BUSINESS"
        ? { businessProfile: { userId } }
        : {}),
    },
    include: {
      businessProfile: {
        select: { userId: true, companyName: true },
      },
      applications: {
        where: {
          ...(applicationId
            ? { id: applicationId }
            : { status: { in: ["PENDING_CONFIRMATION", "SELECTED"] } }),
        },
        take: 1,
        include: {
          team: {
            select: {
              id: true,
              name: true,
              ownerId: true,
              memberships: {
                select: { studentProfile: { select: { userId: true } } },
              },
            },
          },
          proposals: {
            orderBy: { version: "desc" },
            include: {
              files: { orderBy: { createdAt: "asc" } },
              evaluations: { orderBy: { createdAt: "desc" } },
            },
          },
          project: { select: { id: true, status: true } },
        },
      },
      workspaceMessages: {
        where: applicationId
          ? { applicationId }
          : { applicationId: null },
        orderBy: { createdAt: "asc" },
        include: { sender: { select: { id: true, name: true, role: true } } },
      },
    },
  });

  return problem;
}

export function isFinalWorkspaceStatus(status: string): boolean {
  return ["CLOSED", "READY_FOR_IMPLEMENTATION", "COMPLETED"].includes(status);
}

export { isWorkspaceMessageWritableApplicationStatus };
