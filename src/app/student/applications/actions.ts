"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStudent } from "@/lib/student-access";
import { requireOwnedTeam } from "@/lib/student-team";
import { PROBLEM_ACCEPTING_APPLICATION_STATUSES } from "@/lib/problem-workflow";

export type ApplicationActionState = { error: string | null };

const approachFields = [
  ["problemUnderstanding", "Cách nhóm hiểu vấn đề"],
  ["solutionDirection", "Hướng giải quyết"],
  ["methodology", "Phương pháp thực hiện"],
  ["keySteps", "Các bước chính"],
  ["tools", "Công cụ dự kiến"],
  ["resources", "Nguồn lực cần thiết"],
] as const;

function readText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function parseBudget(value: string): number | null {
  if (!value) {
    return null;
  }
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > 2_147_483_647) {
    throw new Error("Chi phí đề xuất phải là số tiền hợp lệ.");
  }
  return amount;
}

function revalidateApplicationPaths(problemId: string) {
  revalidatePath(`/student/problems/${problemId}`);
  revalidatePath("/student/applications");
  revalidatePath(`/business/problems/${problemId}`);
  revalidatePath(`/business/problems/${problemId}/applications`);
}

export async function saveApplicationAction(
  _previousState: ApplicationActionState,
  formData: FormData,
): Promise<ApplicationActionState> {
  const { userId } = await requireStudent();
  const problemId = readText(formData, "problemId");
  if (!problemId) {
    return { error: "Không tìm thấy bài toán." };
  }

  const values: Record<string, string> = Object.fromEntries(
    approachFields.map(([field]) => [field, readText(formData, field)]),
  );
  const estimatedDuration = readText(formData, "estimatedDuration");
  let proposedBudget: number | null;
  try {
    proposedBudget = parseBudget(readText(formData, "proposedBudget"));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Chi phí đề xuất không hợp lệ." };
  }

  if (approachFields.some(([field]) => !values[field]) || !estimatedDuration) {
    return { error: "Vui lòng điền đầy đủ các nội dung Approach và thời gian dự kiến." };
  }
  if (
    approachFields.some(([field]) => values[field].length > 4000) ||
    estimatedDuration.length > 120
  ) {
    return { error: "Một số nội dung vượt quá độ dài cho phép." };
  }

  let problemBusinessUserId = "";
  let wasNewSubmission = false;
  try {
    const team = await requireOwnedTeam(userId);
    await prisma.$transaction(async (transaction) => {
      const problem = await transaction.problem.findFirst({
        where: {
          id: problemId,
          status: { in: [...PROBLEM_ACCEPTING_APPLICATION_STATUSES] },
        },
        select: {
          id: true,
          title: true,
          businessProfile: { select: { userId: true } },
        },
      });
      if (!problem) {
        throw new Error("Bài toán không còn nhận hồ sơ.");
      }

      const existing = await transaction.application.findUnique({
        where: { problemId_teamId: { problemId, teamId: team.id } },
        select: { id: true, status: true },
      });
      if (existing && !["SUBMITTED", "WITHDRAWN"].includes(existing.status)) {
        throw new Error("Hồ sơ này đã được doanh nghiệp xử lý và không thể sửa.");
      }

      const approach = approachFields
        .map(([field, label]) => `${label}:\n${values[field]}`)
        .join("\n\n");
      const applicationData = {
        ...values,
        approach,
        estimatedDuration,
        proposedBudget,
        ...(existing?.status === "WITHDRAWN"
          ? { status: "SUBMITTED", submittedAt: new Date() }
          : {}),
      };

      if (existing) {
        await transaction.application.update({
          where: { id: existing.id },
          data: applicationData,
        });
        wasNewSubmission = existing.status === "WITHDRAWN";
      } else {
        await transaction.application.create({
          data: { problemId, teamId: team.id, ...applicationData },
        });
        wasNewSubmission = true;
      }
      problemBusinessUserId = problem.businessProfile.userId;

      if (wasNewSubmission) {
        await transaction.notification.create({
          data: {
            userId: problemBusinessUserId,
            title: "Nhóm sinh viên vừa gửi hồ sơ",
            message: `Có hồ sơ mới cho bài toán “${problem.title}”.`,
            href: `/business/problems/${problem.id}/applications`,
          },
        });
      }
    });
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message };
    }
    console.error("Gửi hồ sơ ứng tuyển thất bại:", error);
    return { error: "Không thể gửi hồ sơ. Vui lòng thử lại." };
  }

  revalidateApplicationPaths(problemId);
  return { error: null };
}

export async function withdrawApplicationAction(
  _previousState: ApplicationActionState,
  formData: FormData,
): Promise<ApplicationActionState> {
  const { userId } = await requireStudent();
  const problemId = readText(formData, "problemId");
  try {
    const team = await requireOwnedTeam(userId);
    const result = await prisma.application.updateMany({
      where: {
        problemId,
        teamId: team.id,
        status: "SUBMITTED",
        problem: { status: { in: [...PROBLEM_ACCEPTING_APPLICATION_STATUSES] } },
      },
      data: { status: "WITHDRAWN" },
    });
    if (result.count !== 1) {
      return { error: "Chỉ có thể rút hồ sơ khi bài toán còn nhận hồ sơ và doanh nghiệp chưa chọn nhóm." };
    }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message };
    }
    console.error("Rút hồ sơ ứng tuyển thất bại:", error);
    return { error: "Không thể rút hồ sơ. Vui lòng thử lại." };
  }

  revalidateApplicationPaths(problemId);
  return { error: null };
}
