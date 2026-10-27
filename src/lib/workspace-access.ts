import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  isWorkspaceMessageWritableApplicationStatus,
} from "@/lib/problem-workflow";

type WorkspaceDatabase = Pick<
  PrismaClient,
  "application" | "problem" | "trialBriefVersion" | "workspaceMessage"
>;

export async function findAuthorizedWorkspace(
  problemId: string,
  userId: string,
  role: string,
  applicationId?: string,
  database: WorkspaceDatabase = prisma,
) {
  const application = await database.application.findFirst({
    where: {
      ...(applicationId ? { id: applicationId } : { problemId }),
      problem: {
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
        ...(role === "BUSINESS"
          ? { businessProfile: { userId } }
          : {}),
      },
      status: applicationId
        ? { in: ["PENDING_CONFIRMATION", "SELECTED"] }
        : "SELECTED",
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
    orderBy: { status: "desc" },
    select: { id: true, problemId: true },
  });

  const pendingApplication =
    !application && !applicationId && role === "STUDENT"
      ? await database.application.findFirst({
          where: {
            problemId,
            status: "PENDING_CONFIRMATION",
            team: {
              OR: [
                { ownerId: userId },
                { memberships: { some: { studentProfile: { userId } } } },
              ],
            },
            problem: {
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
            },
          },
          select: { id: true, problemId: true },
        })
      : null;
  const resolvedApplication = application ?? pendingApplication;
  if (!resolvedApplication) return null;

  const problem = await database.problem.findFirst({
    where: {
      id: resolvedApplication.problemId,
    },
    include: {
      businessProfile: {
        select: { userId: true, companyName: true },
      },
      applications: {
        where: { id: resolvedApplication.id },
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
    },
  });

  if (!problem) return null;
  const workspaceApplication = problem.applications[0];
  if (!workspaceApplication) return null;
  const trialBriefVersions =
    workspaceApplication.status === "SELECTED" || role === "BUSINESS"
      ? await database.trialBriefVersion.findMany({
          where: { problemId: problem.id },
          orderBy: { version: "desc" },
          include: {
            responses: {
              orderBy: { respondedAt: "asc" },
              include: { respondedBy: { select: { name: true } } },
            },
          },
        })
      : [];
  const workspaceMessages = await database.workspaceMessage.findMany({
    where: {
      problemId,
      OR: [{ applicationId: workspaceApplication.id }, { applicationId: null }],
    },
    orderBy: { createdAt: "asc" },
    include: { sender: { select: { id: true, name: true, role: true } } },
  });

  return { ...problem, trialBriefVersions, workspaceMessages };
}

export function isFinalWorkspaceStatus(status: string): boolean {
  return ["CLOSED", "READY_FOR_IMPLEMENTATION", "COMPLETED"].includes(status);
}

export { isWorkspaceMessageWritableApplicationStatus };
