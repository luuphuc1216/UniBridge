"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStudent } from "@/lib/student-access";
import { requireOwnedTeam } from "@/lib/student-team";
import {
  canEditApplication,
  PROBLEM_ACCEPTING_APPLICATION_STATUSES,
} from "@/lib/problem-workflow";

export type ApplicationActionState = { error: string | null; success?: boolean };

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

function parseApproachLinks(formData: FormData): string[] {
  const links = readText(formData, "approachLinks")
    .split(/\r?\n/)
    .map((link) => link.trim())
    .filter(Boolean);
  if (links.length > 3) throw new Error("Chỉ được thêm tối đa 3 liên kết tham khảo.");
  if (links.some((link) => !/^https?:\/\/\S+$/i.test(link))) {
    throw new Error("Liên kết tham khảo phải bắt đầu bằng http:// hoặc https://.");
  }
  return links;
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
  let approachLinks: string[];
  try {
    proposedBudget = parseBudget(readText(formData, "proposedBudget"));
    approachLinks = parseApproachLinks(formData);
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
        select: { id: true, status: true, profileSnapshotVersion: true },
      });
      if (existing && !canEditApplication(existing.status) && existing.status !== "WITHDRAWN") {
        throw new Error("Hồ sơ này đã được doanh nghiệp xử lý và không thể sửa.");
      }

      const approach = approachFields
        .map(([field, label]) => `${label}:\n${values[field]}`)
        .join("\n\n");
      const profileSnapshotVersion = (existing?.profileSnapshotVersion ?? 0) + 1;
      const profileSnapshot = {
        version: profileSnapshotVersion,
        name: team.name,
        university: team.university,
        description: team.description,
        experience: team.experience,
        relevantProducts: team.relevantProducts,
        achievements: team.achievements,
        interests: team.interests,
        skills: team.skills.map(({ skill }) => skill.name),
        members: team.memberships.map(({ name, major, title, isLead }) => ({
          name,
          major,
          title,
          isLead,
        })),
      };
      const applicationData = {
        ...values,
        approach,
        estimatedDuration,
        proposedBudget,
        profileSnapshot,
        profileSnapshotVersion,
        approachLinks,
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
  return { error: null, success: true };
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
  return { error: null, success: true };
}

export async function acceptInvitationAction(
  _previousState: ApplicationActionState,
  formData: FormData,
): Promise<ApplicationActionState> {
  const { userId } = await requireStudent();
  const applicationId = readText(formData, "applicationId");
  const problemId = readText(formData, "problemId");
  try {
    const team = await requireOwnedTeam(userId);
    await prisma.$transaction(async (transaction) => {
      const invitation = await transaction.applicationInvitation.findFirst({
        where: {
          applicationId,
          problemId,
          teamId: team.id,
          status: "PENDING_CONFIRMATION",
        },
        select: {
          id: true,
          expiresAt: true,
          applicationId: true,
          application: { select: { status: true } },
          problem: { select: { title: true, businessProfile: { select: { userId: true } } } },
        },
      });
      if (!invitation) {
        throw new Error("Lời mời hợp tác không còn hiệu lực hoặc không thuộc về nhóm của bạn.");
      }
      if (invitation.application.status !== "PENDING_CONFIRMATION") {
        throw new Error("Hồ sơ không còn ở trạng thái chờ xác nhận.");
      }
      if (new Date(invitation.expiresAt) <= new Date()) {
        await transaction.application.update({
          where: { id: invitation.applicationId },
          data: { status: "EXPIRED" },
        });
        await transaction.applicationInvitation.update({
          where: { id: invitation.id },
          data: {
            status: "EXPIRED",
            respondedAt: new Date(),
            responseStatus: "EXPIRED",
            responseReason: "Hết hạn phản hồi",
          },
        });
        throw new Error("Lời mời hợp tác đã hết hạn trước khi bạn phản hồi.");
      }

      await transaction.application.updateMany({
        where: {
          problemId,
          id: { not: applicationId },
          status: { in: ["SUBMITTED", "PENDING_CONFIRMATION"] },
        },
        data: { status: "NOT_SELECTED" },
      });
      await transaction.application.update({
        where: { id: invitation.applicationId },
        data: { status: "SELECTED" },
      });
      await transaction.applicationInvitation.update({
        where: { id: invitation.id },
        data: {
          status: "ACCEPTED",
          respondedAt: new Date(),
          responseStatus: "ACCEPTED",
        },
      });
      await transaction.problem.update({
        where: { id: problemId },
        data: { status: "TEAM_SELECTED" },
      });
      await transaction.notification.create({
        data: {
          userId: invitation.problem.businessProfile.userId,
          title: "Nhóm đã đồng ý lời mời hợp tác",
          message: `Nhóm đã đồng ý tham gia bài toán “${invitation.problem.title}”.`,
          href: `/business/problems/${problemId}/workspace`,
        },
      });
    });
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message };
    }
    console.error("Chấp nhận lời mời thất bại:", error);
    return { error: "Không thể chấp nhận lời mời hợp tác. Vui lòng thử lại." };
  }

  revalidateApplicationPaths(problemId);
  return { error: null, success: true };
}

export async function declineInvitationAction(
  _previousState: ApplicationActionState,
  formData: FormData,
): Promise<ApplicationActionState> {
  const { userId } = await requireStudent();
  const applicationId = readText(formData, "applicationId");
  const problemId = readText(formData, "problemId");
  const reason = readText(formData, "declineReason") || "Nhóm không đồng ý với lời mời hợp tác.";
  try {
    const team = await requireOwnedTeam(userId);
    await prisma.$transaction(async (transaction) => {
      const invitation = await transaction.applicationInvitation.findFirst({
        where: {
          applicationId,
          problemId,
          teamId: team.id,
          status: "PENDING_CONFIRMATION",
        },
        select: {
          id: true,
          applicationId: true,
          expiresAt: true,
          application: { select: { status: true } },
          problem: { select: { title: true, businessProfile: { select: { userId: true } } } },
        },
      });
      if (!invitation) {
        throw new Error("Lời mời hợp tác không còn hiệu lực hoặc không thuộc về nhóm của bạn.");
      }
      if (invitation.application.status !== "PENDING_CONFIRMATION") {
        throw new Error("Hồ sơ không còn ở trạng thái chờ xác nhận.");
      }
      if (invitation.expiresAt <= new Date()) {
        await transaction.application.update({
          where: { id: invitation.applicationId },
          data: { status: "EXPIRED" },
        });
        await transaction.applicationInvitation.update({
          where: { id: invitation.id },
          data: {
            status: "EXPIRED",
            respondedAt: new Date(),
            responseStatus: "EXPIRED",
            responseReason: "Hết hạn phản hồi",
          },
        });
        throw new Error("Lời mời hợp tác đã hết hạn trước khi bạn phản hồi.");
      }
      await transaction.application.update({
        where: { id: invitation.applicationId },
        data: { status: "DECLINED" },
      });
      await transaction.applicationInvitation.update({
        where: { id: invitation.id },
        data: {
          status: "DECLINED",
          respondedAt: new Date(),
          responseStatus: "DECLINED",
          responseReason: reason,
        },
      });
      await transaction.notification.create({
        data: {
          userId: invitation.problem.businessProfile.userId,
          title: "Nhóm đã từ chối lời mời hợp tác",
          message: `Nhóm đã từ chối lời mời cho bài toán “${invitation.problem.title}”.`,
          href: `/business/problems/${problemId}/applications`,
        },
      });
    });
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message };
    }
    console.error("Từ chối lời mời thất bại:", error);
    return { error: "Không thể từ chối lời mời hợp tác. Vui lòng thử lại." };
  }

  revalidateApplicationPaths(problemId);
  return { error: null, success: true };
}
