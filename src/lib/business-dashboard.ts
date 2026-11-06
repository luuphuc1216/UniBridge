import type { PrismaClient } from "@/generated/prisma/client";
import { getEffectiveApplicationStatuses } from "@/lib/problem-workflow";

export const BUSINESS_PROBLEM_STATUS_GROUPS = [
  { key: "DRAFT", label: "Nháp", statuses: ["DRAFT"] },
  { key: "PENDING_REVIEW", label: "Chờ duyệt", statuses: ["PENDING_REVIEW"] },
  {
    key: "NEEDS_REVISION",
    label: "Cần chỉnh sửa",
    statuses: ["NEEDS_REVISION", "CHANGES_REQUESTED"],
  },
  {
    key: "APPROVED_OPEN",
    label: "Đã duyệt (đang mở)",
    statuses: ["APPROVED", "PUBLISHED"],
  },
  { key: "REJECTED", label: "Từ chối", statuses: ["REJECTED"] },
  { key: "TEAM_SELECTED", label: "Đã chọn nhóm", statuses: ["TEAM_SELECTED"] },
  { key: "PROTOTYPING", label: "Đang xây dựng Prototype", statuses: ["PROTOTYPING"] },
  { key: "EVALUATING", label: "Đang đánh giá Proposal", statuses: ["EVALUATING"] },
  {
    key: "READY_FOR_IMPLEMENTATION",
    label: "Chờ thỏa thuận triển khai",
    statuses: ["READY_FOR_IMPLEMENTATION"],
  },
  { key: "COMPLETED", label: "Đã hoàn thành", statuses: ["COMPLETED"] },
  { key: "CLOSED", label: "Đã đóng", statuses: ["CLOSED"] },
] as const;

export function getBusinessProblemStatusFilter(status: string | undefined) {
  const group = BUSINESS_PROBLEM_STATUS_GROUPS.find(({ key }) => key === status);
  return group ? { in: [...group.statuses] } : undefined;
}

type ApplicationDatabase = Pick<PrismaClient, "application">;

export async function getEffectiveApplicationCounts(
  problemIds: string[],
  database?: ApplicationDatabase,
): Promise<Map<string, number>> {
  if (problemIds.length === 0) return new Map();
  const applicationDatabase =
    database ?? (await import("@/lib/prisma")).prisma;
  const rows = await applicationDatabase.application.groupBy({
    by: ["problemId"],
    where: {
      problemId: { in: problemIds },
      status: { in: getEffectiveApplicationStatuses() },
    },
    _count: { _all: true },
  });
  return new Map(rows.map((row) => [row.problemId, row._count._all]));
}
