"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStudent } from "@/lib/student-access";
import { requireOwnedTeam } from "@/lib/student-team";
import { attachmentStorage } from "@/lib/storage";
import { validateAttachment } from "@/lib/business-attachments/validation";
import {
  assertApproachAttachmentSetWithinLimits,
  canReplaceApproachAttachments,
  createApproachAttachmentRecords,
  getApproachAttachmentFiles,
} from "@/lib/approach-attachments";
import {
  canEditApplication,
  PROBLEM_ACCEPTING_APPLICATION_STATUSES,
} from "@/lib/problem-workflow";
import { expireInvitationDuringResponse } from "@/lib/invitation-response";

export type ApplicationActionState = {
  error: string | null;
  success?: boolean;
  message?: string;
};

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
  if (
    links.some((link) => {
      try {
        const url = new URL(link);
        return !["http:", "https:"].includes(url.protocol) || !url.hostname;
      } catch {
        return true;
      }
    })
  ) {
    throw new Error("Liên kết tham khảo phải là địa chỉ HTTP hoặc HTTPS hợp lệ.");
  }
  return links;
}

async function removeStoredFiles(storageKeys: string[]) {
  const results = await Promise.allSettled(
    storageKeys.map((storageKey) => attachmentStorage.delete(storageKey)),
  );
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(
        `Không thể dọn tệp Approach ${storageKeys[index]}:`,
        result.reason,
      );
    }
  });
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
  const intent = readText(formData, "intent") || "submit";
  if (!problemId) {
    return { error: "Không tìm thấy bài toán." };
  }
  if (intent !== "draft" && intent !== "submit") {
    return { error: "Thao tác lưu hồ sơ không hợp lệ." };
  }
  let team: Awaited<ReturnType<typeof requireOwnedTeam>>;
  try {
    team = await requireOwnedTeam(userId);
  } catch (error) {
    if (error instanceof Error) return { error: error.message };
    console.error("Không thể xác minh quyền của nhóm khi gửi hồ sơ:", error);
    return { error: "Không thể xác minh quyền của nhóm. Vui lòng thử lại." };
  }

  const values: Record<string, string> = Object.fromEntries(
    approachFields.map(([field]) => [field, readText(formData, field)]),
  );
  const removedAttachmentIds = formData
    .getAll("removeApproachAttachment")
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
  if (
    formData.getAll("removeApproachAttachment").some((value) => typeof value !== "string") ||
    removedAttachmentIds.length > 3
  ) {
    return { error: "Danh sách tài liệu cần xóa không hợp lệ." };
  }
  const estimatedDuration = readText(formData, "estimatedDuration");
  let proposedBudget: number | null;
  let approachLinks: string[];
  let uploadedAttachments: Awaited<ReturnType<typeof validateAttachment>>[];
  try {
    proposedBudget = parseBudget(readText(formData, "proposedBudget"));
    approachLinks = parseApproachLinks(formData);
    uploadedAttachments = await Promise.all(
      getApproachAttachmentFiles(formData).map(validateAttachment),
    );
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Không thể kiểm tra tài liệu đính kèm.",
    };
  }

  if (
    intent === "submit" &&
    (approachFields.some(([field]) => !values[field]) || !estimatedDuration)
  ) {
    return { error: "Vui lòng điền đầy đủ các nội dung Approach và thời gian dự kiến." };
  }
  if (
    approachFields.some(([field]) => values[field].length > 4000) ||
    estimatedDuration.length > 120
  ) {
    return { error: "Một số nội dung vượt quá độ dài cho phép." };
  }

  const storedAttachmentRecords: {
    applicationId: string;
    submissionVersion: number;
    originalName: string;
    contentType: string;
    sizeBytes: number;
    storageKey: string;
  }[] = [];
  const obsoleteStorageKeys: string[] = [];
  let problemBusinessUserId = "";
  let wasNewSubmission = false;
  try {
    for (const attachment of uploadedAttachments) {
      const storageKey = randomUUID();
      await attachmentStorage.save(storageKey, attachment.content);
      storedAttachmentRecords.push({
        applicationId: "",
        submissionVersion: 0,
        originalName: attachment.originalName,
        contentType: attachment.contentType,
        sizeBytes: attachment.sizeBytes,
        storageKey,
      });
    }

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
        select: {
          id: true,
          status: true,
          profileSnapshotVersion: true,
          attachmentVersion: true,
        },
      });
      if (existing && !canEditApplication(existing.status) && existing.status !== "WITHDRAWN") {
        throw new Error("Hồ sơ này đã được doanh nghiệp xử lý và không thể sửa.");
      }
      if (intent === "draft" && existing && existing.status !== "DRAFT") {
        throw new Error("Chỉ có thể lưu nháp khi hồ sơ chưa được gửi.");
      }
      if (
        (storedAttachmentRecords.length > 0 || removedAttachmentIds.length > 0) &&
        !canReplaceApproachAttachments(existing?.status ?? null)
      ) {
        throw new Error("Tài liệu đã gửi bị khóa và không thể thêm, sửa hoặc xóa.");
      }
      if (removedAttachmentIds.length > 0 && existing?.status !== "DRAFT") {
        throw new Error("Chỉ có thể xóa tài liệu trong bản nháp.");
      }

      const approach = approachFields
        .map(([field, label]) => `${label}:\n${values[field]}`)
        .join("\n\n");
      const profileSnapshotVersion =
        existing && existing.status !== "DRAFT"
          ? existing.profileSnapshotVersion + 1
          : existing?.profileSnapshotVersion ?? 1;
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
      const attachmentVersion =
        intent === "draft"
          ? 0
          : existing?.status === "WITHDRAWN"
            ? existing.attachmentVersion + 1
            : existing?.status === "DRAFT"
              ? 1
              : existing?.attachmentVersion ?? 1;
      const applicationData = {
        ...values,
        approach,
        estimatedDuration,
        proposedBudget,
        profileSnapshotVersion,
        approachLinks,
        status: intent === "draft" ? "DRAFT" : "SUBMITTED",
        attachmentVersion,
        ...(intent === "submit" ? { profileSnapshot } : {}),
        ...(intent === "submit" &&
        (!existing || existing.status === "DRAFT" || existing.status === "WITHDRAWN")
          ? { submittedAt: new Date() }
          : {}),
      };

      let applicationId = existing?.id;
      if (existing) {
        await transaction.application.update({
          where: { id: existing.id },
          data: applicationData,
        });
        applicationId = existing.id;
      } else {
        const created = await transaction.application.create({
          data: { problemId, teamId: team.id, ...applicationData },
          select: { id: true },
        });
        applicationId = created.id;
      }
      if (!applicationId) {
        throw new Error("Không tìm thấy hồ sơ ứng tuyển cần lưu.");
      }

      if (existing?.status === "DRAFT") {
        const previousFiles = await transaction.approachAttachment.findMany({
          where: { applicationId, submissionVersion: 0 },
          select: { id: true, storageKey: true, sizeBytes: true },
        });
        const filesToRemove = previousFiles.filter(({ id }) =>
          removedAttachmentIds.includes(id),
        );
        if (filesToRemove.length !== removedAttachmentIds.length) {
          throw new Error("Không tìm thấy tài liệu cần xóa trong bản nháp này.");
        }
        const remainingFiles = previousFiles.filter(
          ({ id }) => !removedAttachmentIds.includes(id),
        );
        assertApproachAttachmentSetWithinLimits(
          remainingFiles,
          storedAttachmentRecords,
        );
        if (filesToRemove.length > 0) {
          obsoleteStorageKeys.push(...filesToRemove.map(({ storageKey }) => storageKey));
          await transaction.approachAttachment.deleteMany({
            where: { id: { in: filesToRemove.map(({ id }) => id) }, applicationId },
          });
        }
      }
      if (intent === "submit" && existing?.status === "DRAFT") {
        if (storedAttachmentRecords.length > 0) {
          await createApproachAttachmentRecords(
            transaction.approachAttachment,
            storedAttachmentRecords.map((record) => ({
              ...record,
              applicationId,
              submissionVersion: 1,
            })),
          );
        }
        await transaction.approachAttachment.updateMany({
          where: { applicationId, submissionVersion: 0 },
          data: { submissionVersion: 1 },
        });
      } else if (storedAttachmentRecords.length > 0) {
        await createApproachAttachmentRecords(
          transaction.approachAttachment,
          storedAttachmentRecords.map((record) => ({
            ...record,
            applicationId,
            submissionVersion:
              intent === "draft" ? 0 : attachmentVersion,
          })),
        );
      }

      if (intent === "submit") {
        wasNewSubmission =
          !existing || existing.status === "DRAFT" || existing.status === "WITHDRAWN";
      } else {
        wasNewSubmission = false;
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
    await removeStoredFiles(storedAttachmentRecords.map(({ storageKey }) => storageKey));
    if (error instanceof Error) {
      return { error: error.message };
    }
    console.error("Gửi hồ sơ ứng tuyển thất bại:", error);
    return { error: "Không thể gửi hồ sơ. Vui lòng thử lại." };
  }

  await removeStoredFiles([...new Set(obsoleteStorageKeys)]);
  revalidateApplicationPaths(problemId);
  return {
    error: null,
    success: true,
    message: intent === "draft" ? "Đã lưu bản nháp." : "Đã gửi hồ sơ thành công.",
  };
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
    const expired = await prisma.$transaction(async (transaction) => {
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
          problemId: true,
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
      const now = new Date();
      if (invitation.expiresAt <= now) {
        const expired = await expireInvitationDuringResponse(transaction, {
          invitationId: invitation.id,
          applicationId: invitation.applicationId,
          problemId: invitation.problemId,
          businessUserId: invitation.problem.businessProfile.userId,
          problemTitle: invitation.problem.title,
          now,
        });
        if (!expired) {
          throw new Error("Lời mời hợp tác không còn hiệu lực hoặc không thuộc về nhóm của bạn.");
        }
        return true;
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
      return false;
    });
    if (expired) {
      revalidateApplicationPaths(problemId);
      return { error: "Lời mời hợp tác đã hết hạn trước khi bạn phản hồi." };
    }
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
    const expired = await prisma.$transaction(async (transaction) => {
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
          problemId: true,
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
      const now = new Date();
      if (invitation.expiresAt <= now) {
        const expired = await expireInvitationDuringResponse(transaction, {
          invitationId: invitation.id,
          applicationId: invitation.applicationId,
          problemId: invitation.problemId,
          businessUserId: invitation.problem.businessProfile.userId,
          problemTitle: invitation.problem.title,
          now,
        });
        if (!expired) {
          throw new Error("Lời mời hợp tác không còn hiệu lực hoặc không thuộc về nhóm của bạn.");
        }
        return true;
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
      return false;
    });
    if (expired) {
      revalidateApplicationPaths(problemId);
      return { error: "Lời mời hợp tác đã hết hạn trước khi bạn phản hồi." };
    }
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
