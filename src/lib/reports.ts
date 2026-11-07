import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import type { PrismaClient } from "@/generated/prisma/client";
import { reputationConfig } from "@/lib/reputation-config";
import { findAuthorizedWorkspace } from "@/lib/workspace-access";
import { writeAuditLog } from "./audit-log";

export const reportTargetTypes = ["PROBLEM", "TEAM", "MESSAGE", "REVIEW"] as const;
export type ReportTargetType = (typeof reportTargetTypes)[number];
export const reportStatuses = ["NEW", "IN_PROGRESS", "RESOLVED", "DISMISSED"] as const;
export type ReportStatus = (typeof reportStatuses)[number];
export const reportActionStatuses = ["IN_PROGRESS", "RESOLVED", "DISMISSED"] as const;
export type ReportActionStatus = (typeof reportActionStatuses)[number];

export type SubmitReportResult = "created" | "duplicate" | "target_unavailable";

const reportStatusLabels: Record<ReportStatus, string> = {
  NEW: "Mới",
  IN_PROGRESS: "Đang xử lý",
  RESOLVED: "Đã xử lý",
  DISMISSED: "Bác bỏ",
};

function getReporterHome(role: string): string {
  if (role === "BUSINESS") return "/business";
  if (role === "STUDENT") return "/student";
  if (role === "ADMIN") return "/admin";
  return "/";
}

function openKey(reporterId: string, targetType: string, targetId: string): string {
  return createHash("sha256")
    .update(`${reporterId}\u0000${targetType}\u0000${targetId}`)
    .digest("hex");
}

export async function submitReport(
  client: PrismaClient,
  {
    reporterId,
    reporterRole,
    targetType,
    targetId,
    reason,
  }: {
    reporterId: string;
    reporterRole: string;
    targetType: ReportTargetType;
    targetId: string;
    reason: string;
  },
): Promise<SubmitReportResult> {
  const cleanedReason = reason.trim();
  if (!targetId || targetId.length > 200 || cleanedReason.length < 5 || cleanedReason.length > 2000) {
    throw new Error("Vui lòng cung cấp đối tượng và lý do báo cáo hợp lệ.");
  }

  let snapshot: Record<string, string | number | Date>;
  if (targetType === "PROBLEM") {
    const target = await client.problem.findFirst({
      where: {
        id: targetId,
        hiddenByAdmin: false,
        OR: [
          {
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
          { businessProfile: { userId: reporterId } },
          {
            applications: {
              some: {
                status: { in: ["PENDING_CONFIRMATION", "SELECTED"] },
                team: {
                  OR: [
                    { ownerId: reporterId },
                    { memberships: { some: { studentProfile: { userId: reporterId } } } },
                  ],
                },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        title: true,
        description: true,
        goal: true,
        status: true,
      },
    });
    if (!target) return "target_unavailable";
    snapshot = target;
  } else if (targetType === "TEAM") {
    const target = await client.studentTeam.findFirst({
      where: { id: targetId, hiddenByAdmin: false },
      select: {
        id: true,
        name: true,
        university: true,
        description: true,
        experience: true,
        achievements: true,
      },
    });
    if (!target) return "target_unavailable";
    snapshot = target;
  } else if (targetType === "MESSAGE") {
    const target = await client.workspaceMessage.findFirst({
      where: { id: targetId, hiddenByAdmin: false },
      select: {
        id: true,
        content: true,
        createdAt: true,
        sender: { select: { name: true, role: true } },
        problemId: true,
        applicationId: true,
      },
    });
    if (!target) return "target_unavailable";
    const workspace = await findAuthorizedWorkspace(
      target.problemId,
      reporterId,
      reporterRole,
      target.applicationId ?? undefined,
      client,
    );
    if (!workspace) return "target_unavailable";
    snapshot = {
      id: target.id,
      content: target.content,
      createdAt: target.createdAt,
      senderName: target.sender.name,
      senderRole: target.sender.role,
    };
  } else {
    const review = await client.review.findFirst({
      where: { id: targetId, hiddenByAdmin: false },
      select: { direction: true },
    });
    if (!review) return "target_unavailable";
    const oppositeDirection =
      review.direction === "BUSINESS_TO_TEAM" ? "TEAM_TO_BUSINESS" : "BUSINESS_TO_TEAM";
    const visibleAfter = new Date(
      Date.now() - reputationConfig.reviewVisibilityDelayDays * 86_400_000,
    );
    const target = await client.review.findFirst({
      where: {
        id: targetId,
        hiddenByAdmin: false,
        project: {
          OR: [
            { application: { problem: { businessProfile: { userId: reporterId } } } },
            {
              team: {
                OR: [
                  { ownerId: reporterId },
                  { memberships: { some: { studentProfile: { userId: reporterId } } } },
                ],
              },
            },
            {
              status: "COMPLETED",
              OR: [
                { completedAt: { lte: visibleAfter } },
                { reviews: { some: { direction: oppositeDirection } } },
              ],
            },
          ],
        },
      },
      select: {
        id: true,
        rating: true,
        content: true,
        createdAt: true,
        direction: true,
        projectId: true,
      },
    });
    if (!target) return "target_unavailable";
    snapshot = target;
  }

  try {
    await client.report.create({
      data: {
        reporterId,
        targetType,
        targetId,
        snapshot: JSON.stringify(snapshot),
        reason: cleanedReason,
        openKey: openKey(reporterId, targetType, targetId),
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return "duplicate";
    }
    throw error;
  }
  return "created";
}

export async function updateReport(
  client: PrismaClient,
  {
    actorId,
    reportId,
    nextStatus,
    reason,
    hideContent,
  }: {
    actorId: string;
    reportId: string;
    nextStatus: ReportStatus;
    reason: string;
    hideContent: boolean;
  },
): Promise<"updated" | "unchanged" | "missing" | "conflict" | "invalid"> {
  const resolutionReason = reason.trim();
  if (
    !reportActionStatuses.includes(nextStatus as ReportActionStatus) ||
    resolutionReason.length === 0 ||
    resolutionReason.length > 500 ||
    (hideContent && nextStatus !== "RESOLVED")
  ) {
    return "invalid";
  }

  try {
    return await client.$transaction(async (transaction) => {
    const report = await transaction.report.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        status: true,
        targetType: true,
        targetId: true,
        reporter: { select: { id: true, role: true } },
      },
    });
    if (!report) return "missing";
    if (report.status === nextStatus) return "unchanged";
    if (report.status !== "NEW" && report.status !== "IN_PROGRESS") return "conflict";

    const isFinal = nextStatus === "RESOLVED" || nextStatus === "DISMISSED";
    const result = await transaction.report.updateMany({
      where: { id: report.id, status: report.status },
      data: {
        status: nextStatus,
        handlerId: actorId,
        resolutionReason,
        handledAt: new Date(),
        contentHidden: hideContent,
        openKey: isFinal ? null : undefined,
      },
    });
    if (result.count !== 1) return "conflict";

    if (hideContent) {
      let updated = 0;
      if (report.targetType === "PROBLEM") {
        updated = (await transaction.problem.updateMany({
          where: { id: report.targetId, hiddenByAdmin: false },
          data: { hiddenByAdmin: true },
        })).count;
        if (updated === 0 && !(await transaction.problem.findFirst({
          where: { id: report.targetId, hiddenByAdmin: true },
          select: { id: true },
        }))) throw new Error("REPORT_TARGET_MISSING");
      } else if (report.targetType === "TEAM") {
        updated = (await transaction.studentTeam.updateMany({
          where: { id: report.targetId, hiddenByAdmin: false },
          data: { hiddenByAdmin: true },
        })).count;
        if (updated === 0 && !(await transaction.studentTeam.findFirst({
          where: { id: report.targetId, hiddenByAdmin: true },
          select: { id: true },
        }))) throw new Error("REPORT_TARGET_MISSING");
      } else if (report.targetType === "MESSAGE") {
        updated = (await transaction.workspaceMessage.updateMany({
          where: { id: report.targetId, hiddenByAdmin: false },
          data: { hiddenByAdmin: true },
        })).count;
        if (updated === 0 && !(await transaction.workspaceMessage.findFirst({
          where: { id: report.targetId, hiddenByAdmin: true },
          select: { id: true },
        }))) throw new Error("REPORT_TARGET_MISSING");
      } else if (report.targetType === "REVIEW") {
        updated = (await transaction.review.updateMany({
          where: { id: report.targetId, hiddenByAdmin: false },
          data: { hiddenByAdmin: true },
        })).count;
        if (updated === 0 && !(await transaction.review.findFirst({
          where: { id: report.targetId, hiddenByAdmin: true },
          select: { id: true },
        }))) throw new Error("REPORT_TARGET_MISSING");
      } else {
        throw new Error("REPORT_TARGET_MISSING");
      }
    }

    await writeAuditLog(transaction, {
      actorId,
      action: "REPORT_UPDATED",
      targetType: "Report",
      targetId: report.id,
      metadata: { status: nextStatus, contentHidden: hideContent },
    });
    await transaction.notification.create({
      data: {
        userId: report.reporter.id,
        title: "Báo cáo của bạn đã được cập nhật",
        message: `Trạng thái báo cáo hiện tại: ${reportStatusLabels[nextStatus]}.`,
        href: getReporterHome(report.reporter.role),
        dedupeKey: `report-update:${report.id}:${randomUUID()}`,
      },
    });
    return "updated";
    });
  } catch (error) {
    if (error instanceof Error && error.message === "REPORT_TARGET_MISSING") {
      return "missing";
    }
    throw error;
  }
}
