import type { PrismaClient } from "@/generated/prisma/client";
import { getEffectiveApplicationStatuses } from "@/lib/problem-workflow";

export const BUSINESS_PROBLEM_STATUSES = [
  ["DRAFT", "Nháp"],
  ["PENDING_REVIEW", "Chờ duyệt"],
  ["NEEDS_REVISION", "Cần chỉnh sửa"],
  ["CHANGES_REQUESTED", "Cần chỉnh sửa"],
  ["APPROVED", "Đã duyệt (đang mở)"],
  ["PUBLISHED", "Đã duyệt (đang mở)"],
  ["REJECTED", "Từ chối"],
  ["TEAM_SELECTED", "Đã chọn nhóm"],
  ["PROTOTYPING", "Đang xây dựng Prototype"],
  ["EVALUATING", "Đang đánh giá Proposal"],
  ["READY_FOR_IMPLEMENTATION", "Chờ thỏa thuận triển khai"],
  ["COMPLETED", "Đã hoàn thành"],
  ["CLOSED", "Đã đóng"],
] as const;

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
