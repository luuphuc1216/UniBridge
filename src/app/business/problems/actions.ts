"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { MAX_ATTACHMENT_COUNT } from "@/lib/business-attachments/config";
import { validateAttachment } from "@/lib/business-attachments/validation";
import { prisma } from "@/lib/prisma";
import { attachmentStorage } from "@/lib/storage";
import {
  getInvitationDeadline,
  getInvitationReminderAt,
} from "@/lib/invitation-config";
import { canCreatePendingInvitation, getBusinessCloseBlockReason } from "@/lib/problem-workflow";
import { submitProblemForReview } from "@/lib/post-credits";

export type ProblemActionState = {
  error: string | null;
  actionHref?: string;
};

function getText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isPrismaError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    /^P\d{4}$/.test(error.code)
  );
}

function parseBudget(formData: FormData) {
  const minValue = getText(formData, "budgetMin");
  const maxValue = getText(formData, "budgetMax");
  const budgetMin = minValue ? Number(minValue) : null;
  const budgetMax = maxValue ? Number(maxValue) : null;

  if (
    (budgetMin !== null && (!Number.isSafeInteger(budgetMin) || budgetMin < 0)) ||
    (budgetMax !== null && (!Number.isSafeInteger(budgetMax) || budgetMax < 0))
  ) {
    throw new Error("Ngân sách cần là số nguyên không âm.");
  }
  if (
    budgetMin !== null &&
    budgetMax !== null &&
    budgetMin > budgetMax
  ) {
    throw new Error("Ngân sách tối thiểu không được lớn hơn ngân sách tối đa.");
  }

  return { budgetMin, budgetMax };
}

function validateProblemFields(formData: FormData) {
  const fields = {
    title: getText(formData, "title"),
    description: getText(formData, "description"),
    goal: getText(formData, "goal"),
    field: getText(formData, "field"),
    requirements: getText(formData, "requirements"),
    expectedDuration: getText(formData, "expectedDuration"),
  };
  if (Object.values(fields).some((value) => value.length < 2)) {
    throw new Error("Vui lòng điền đầy đủ thông tin bài toán.");
  }
  if (fields.title.length > 200 || fields.field.length > 100) {
    throw new Error("Tên vấn đề tối đa 200 ký tự, lĩnh vực tối đa 100 ký tự.");
  }
  return { ...fields, ...parseBudget(formData) };
}

function getUploadedFiles(formData: FormData): File[] {
  return formData
    .getAll("attachments")
    .filter((value): value is File => value instanceof File && value.size > 0);
}

async function getBusinessContext() {
  const session = await auth();
  if (!session?.user || session.user.role !== "BUSINESS") {
    throw new Error("Bạn cần đăng nhập bằng tài khoản doanh nghiệp.");
  }

  const profile = await prisma.businessProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) {
    throw new Error("Không tìm thấy hồ sơ doanh nghiệp.");
  }
  return { userId: session.user.id, businessProfileId: profile.id };
}

function makeSlug(title: string): string {
  const slug = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return `${slug || "problem"}-${randomUUID().slice(0, 8)}`;
}

async function validateAndStoreFiles(
  files: File[],
  existingCount: number,
) {
  if (files.length + existingCount > MAX_ATTACHMENT_COUNT) {
    throw new Error(`Mỗi bài toán được đính kèm tối đa ${MAX_ATTACHMENT_COUNT} tệp.`);
  }

  const validated = [];
  for (const file of files) {
    validated.push(await validateAttachment(file));
  }

  const stored: Array<{
    storageKey: string;
    originalName: string;
    contentType: string;
    sizeBytes: number;
  }> = [];

  try {
    for (const attachment of validated) {
      const storageKey = randomUUID();
      await attachmentStorage.save(storageKey, attachment.content);
      stored.push({
        storageKey,
        originalName: attachment.originalName,
        contentType: attachment.contentType,
        sizeBytes: attachment.sizeBytes,
      });
    }
  } catch (error) {
    await Promise.all(
      stored.map(async ({ storageKey }) => {
        try {
          await attachmentStorage.delete(storageKey);
        } catch (cleanupError) {
          console.error("Không thể dọn tệp upload chưa được lưu metadata:", cleanupError);
        }
      }),
    );
    throw error;
  }
  return stored;
}

export async function createProblemAction(
  _previousState: ProblemActionState,
  formData: FormData,
): Promise<ProblemActionState> {
  let stored: Awaited<ReturnType<typeof validateAndStoreFiles>> = [];
  let problemId: string;
  try {
    const { businessProfileId } = await getBusinessContext();
    const fields = validateProblemFields(formData);
    const files = getUploadedFiles(formData);
    stored = await validateAndStoreFiles(files, 0);
    const problem = await prisma.problem.create({
      data: {
        ...fields,
        businessProfileId,
        slug: makeSlug(fields.title),
        status: "DRAFT",
        attachments: {
          create: stored,
        },
      },
      select: { id: true },
    });
    problemId = problem.id;
    if (getText(formData, "intent") === "submit") {
      let result;
      try {
        result = await prisma.$transaction((transaction) =>
          submitProblemForReview(transaction, { businessProfileId, problemId }),
        );
      } catch (error) {
        console.error("Không thể gửi Problem mới để kiểm duyệt:", error);
        return {
          error: "Không thể gửi duyệt lúc này, bản nháp đã được lưu.",
          actionHref: `/business/problems/${problemId}/edit`,
        };
      }
      if (result.status === "no_credits") {
        return {
          error:
            "Bài toán đã được lưu thành bản nháp nhưng bạn đã hết lượt đăng. Hãy mua thêm lượt rồi gửi lại.",
          actionHref: `/business/problems/${problemId}/edit`,
        };
      }
    }
  } catch (error) {
    await Promise.all(
      stored.map(async ({ storageKey }) => {
        try {
          await attachmentStorage.delete(storageKey);
        } catch (cleanupError) {
          console.error("Không thể dọn tệp upload sau lỗi tạo Problem:", cleanupError);
        }
      }),
    );
    if (error instanceof Error && !isPrismaError(error)) {
      return { error: error.message };
    }
    console.error("Tạo Problem thất bại:", error);
    return { error: "Không thể tạo bài toán. Vui lòng thử lại." };
  }

  revalidatePath("/business/problems");
  redirect(`/business/problems/${problemId}`);
}

export async function updateProblemAction(
  _previousState: ProblemActionState,
  formData: FormData,
): Promise<ProblemActionState> {
  let stored: Awaited<ReturnType<typeof validateAndStoreFiles>> = [];
  const problemId = getText(formData, "problemId");
  const deletedAttachmentIds = formData
    .getAll("deletedAttachmentIds")
    .filter((value): value is string => typeof value === "string");
  let removedStorageKeys: string[] = [];
  let businessProfileId = "";
  const shouldSubmit = getText(formData, "intent") === "submit";

  try {
    ({ businessProfileId } = await getBusinessContext());
    const problem = await prisma.problem.findFirst({
      where: {
        id: problemId,
        businessProfileId,
        status: { in: ["DRAFT", "NEEDS_REVISION", "CHANGES_REQUESTED"] },
      },
      select: { id: true, status: true },
    });
    if (!problem) {
      throw new Error("Không tìm thấy bài toán hoặc bài toán không còn được phép chỉnh sửa.");
    }

    const fields = validateProblemFields(formData);
    const attachmentsToDelete = await prisma.problemAttachment.findMany({
      where: {
        problemId,
        id: { in: deletedAttachmentIds },
      },
      select: { id: true, storageKey: true },
    });
    const currentCount = await prisma.problemAttachment.count({
      where: {
        problemId,
        id: { notIn: attachmentsToDelete.map(({ id }) => id) },
      },
    });
    stored = await validateAndStoreFiles(getUploadedFiles(formData), currentCount);

    await prisma.$transaction(async (transaction) => {
      await transaction.problem.update({
        where: { id: problemId },
        data: {
          ...fields,
          attachments: { create: stored },
        },
      });
      if (attachmentsToDelete.length > 0) {
        await transaction.problemAttachment.deleteMany({
          where: { id: { in: attachmentsToDelete.map(({ id }) => id) } },
        });
      }
    });
    removedStorageKeys = attachmentsToDelete.map(({ storageKey }) => storageKey);
  } catch (error) {
    await Promise.all(
      stored.map(async ({ storageKey }) => {
        try {
          await attachmentStorage.delete(storageKey);
        } catch (cleanupError) {
          console.error("Không thể dọn tệp upload sau lỗi cập nhật Problem:", cleanupError);
        }

      }),
    );
    if (error instanceof Error && !isPrismaError(error)) {
      return { error: error.message };
    }
    console.error("Cập nhật Problem thất bại:", error);
    return { error: "Không thể cập nhật bài toán. Vui lòng thử lại." };
  }

  if (shouldSubmit) {
    let result;
    try {
      result = await prisma.$transaction((transaction) =>
        submitProblemForReview(transaction, { businessProfileId, problemId }),
      );
    } catch (error) {
      console.error("Không thể gửi Problem đã lưu để kiểm duyệt:", error);
      for (const storageKey of removedStorageKeys) {
        try {
          await attachmentStorage.delete(storageKey);
        } catch (cleanupError) {
          console.error("Không thể dọn tệp đã xóa sau lỗi gửi duyệt:", cleanupError);
        }
      }
      return {
        error: "Không thể gửi duyệt lúc này, bản nháp đã được lưu.",
        actionHref: `/business/problems/${problemId}/edit`,
      };
    }
    if (result.status === "no_credits") {
      return {
        error:
          "Bài toán đã được lưu thành bản nháp nhưng bạn đã hết lượt đăng. Hãy mua thêm lượt rồi gửi lại.",
        actionHref: `/business/problems/${problemId}/edit`,
      };
    }
  }

  const cleanupErrors: unknown[] = [];
  for (const storageKey of removedStorageKeys) {
    try {
      await attachmentStorage.delete(storageKey);
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  if (cleanupErrors.length > 0) {
    console.error("Không thể xóa một số tệp đính kèm sau khi cập nhật:", cleanupErrors);
    return {
      error: "Thông tin đã cập nhật nhưng một số tệp chưa được dọn khỏi bộ nhớ.",
    };
  }

  revalidatePath("/business/problems");
  revalidatePath(`/business/problems/${problemId}`);
  redirect(`/business/problems/${problemId}`);
}

export async function sendInvitationAction(
  _previousState: ProblemActionState,
  formData: FormData,
): Promise<ProblemActionState> {
  const problemId = getText(formData, "problemId");
  const applicationId = getText(formData, "applicationId");
  try {
    const { businessProfileId } = await getBusinessContext();
    await prisma.$transaction(async (transaction) => {
      const problem = await transaction.problem.findFirst({
        where: {
          id: problemId,
          businessProfileId,
          status: { in: ["APPROVED", "PUBLISHED"] },
        },
        select: { id: true, title: true },
      });
      if (!problem) {
        throw new Error("Chỉ có thể mời nhóm cho bài toán đã được duyệt.");
      }

      const activeInvitation = await transaction.applicationInvitation.findFirst({
        where: { problemId, status: "PENDING_CONFIRMATION" },
        select: { id: true },
      });
      if (!canCreatePendingInvitation(activeInvitation ? 1 : 0)) {
        throw new Error("Bài toán này đã có lời mời hợp tác đang chờ phản hồi.");
      }

      const application = await transaction.application.findFirst({
        where: { id: applicationId, problemId, status: { in: ["SUBMITTED", "PENDING_CONFIRMATION"] } },
        select: {
          id: true,
          status: true,
          team: {
            select: {
              id: true,
              ownerId: true,
              memberships: {
                select: { studentProfile: { select: { userId: true } } },
              },
            },
          },
        },
      });
      if (!application) {
        throw new Error("Hồ sơ ứng tuyển không còn khả dụng để mời hợp tác.");
      }

      const now = new Date();
      const expiresAt = getInvitationDeadline(now);
      const reminderAt = getInvitationReminderAt(now);
      await transaction.application.update({
        where: { id: application.id },
        data: { status: "PENDING_CONFIRMATION" },
      });
      await transaction.applicationInvitation.create({
        data: {
          applicationId: application.id,
          problemId: problem.id,
          teamId: application.team.id,
          invitedByBusinessProfileId: businessProfileId,
          status: "PENDING_CONFIRMATION",
          expiresAt,
          reminderAt,
          responseStatus: "PENDING_CONFIRMATION",
        },
      });
      const studentUserIds = [
        application.team.ownerId,
        ...application.team.memberships.map(({ studentProfile }) => studentProfile?.userId),
      ].filter((userId): userId is string => Boolean(userId));
      await transaction.notification.createMany({
        data: [...new Set(studentUserIds)].map((userId) => ({
          userId,
          title: "Bạn nhận được lời mời hợp tác mới",
          message: `Doanh nghiệp đã gửi lời mời hợp tác cho bài toán “${problem.title}”.`,
          href: `/student/problems/${problem.id}#application-response`,
        })),
      });
    });
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message };
    }
    console.error("Gửi lời mời thất bại:", error);
    return { error: "Không thể gửi lời mời hợp tác. Vui lòng thử lại." };
  }

  revalidatePath(`/business/problems/${problemId}`);
  revalidatePath(`/business/problems/${problemId}/applications`);
  revalidatePath("/student/applications");
  revalidatePath(`/student/problems/${problemId}`);
  return { error: null };
}

export async function selectTeamAction(
  _previousState: ProblemActionState,
  formData: FormData,
): Promise<ProblemActionState> {
  const problemId = getText(formData, "problemId");
  const applicationId = getText(formData, "applicationId");
  try {
    const { businessProfileId } = await getBusinessContext();
    await prisma.$transaction(async (transaction) => {
      const problem = await transaction.problem.findFirst({
        where: {
          id: problemId,
          businessProfileId,
          status: { in: ["APPROVED", "PUBLISHED"] },
        },
        select: { id: true },
      });
      if (!problem) {
        throw new Error("Chỉ có thể chọn nhóm cho bài toán đã được duyệt.");
      }

      const selected = await transaction.application.findFirst({
        where: { id: applicationId, problemId, status: "PENDING_CONFIRMATION" },
        select: {
          id: true,
          team: {
            select: {
              ownerId: true,
              memberships: {
                select: { studentProfile: { select: { userId: true } } },
              },
            },
          },
        },
      });
      if (!selected) {
        throw new Error("Chỉ có thể chọn nhóm sau khi nhóm đã đồng ý lời mời.");
      }

      await transaction.problem.update({
        where: { id: problemId },
        data: { status: "TEAM_SELECTED" },
      });
      await transaction.application.updateMany({
        where: { problemId, id: { not: applicationId }, status: { in: ["SUBMITTED", "PENDING_CONFIRMATION"] } },
        data: { status: "NOT_SELECTED" },
      });
      await transaction.application.update({
        where: { id: applicationId },
        data: { status: "SELECTED" },
      });
      const studentUserIds = [
        selected.team.ownerId,
        ...selected.team.memberships.map(({ studentProfile }) => studentProfile?.userId),
      ].filter((userId): userId is string => Boolean(userId));
      await transaction.notification.createMany({
        data: [...new Set(studentUserIds)].map((userId) => ({
          userId,
          title: "Nhóm của bạn đã được doanh nghiệp lựa chọn",
          message: "Hãy mở không gian làm việc để xem và xác nhận hồ sơ dự án thử nghiệm.",
          href: `/student/workspace/${problemId}`,
        })),
      });
    });
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message };
    }
    console.error("Chọn nhóm thất bại:", error);
    return { error: "Không thể chọn nhóm. Vui lòng thử lại." };
  }

  revalidatePath(`/business/problems/${problemId}`);
  revalidatePath(`/business/problems/${problemId}/applications`);
  revalidatePath("/student/applications");
  revalidatePath(`/student/problems/${problemId}`);
  redirect(`/business/problems/${problemId}/workspace`);
}

export async function updateApplicationReviewAction(
  _previousState: ProblemActionState,
  formData: FormData,
): Promise<ProblemActionState> {
  const applicationId = getText(formData, "applicationId");
  const problemId = getText(formData, "problemId");
  const note = getText(formData, "businessReviewNote");
  try {
    const { businessProfileId } = await getBusinessContext();
    await prisma.application.updateMany({
      where: {
        id: applicationId,
        problemId,
        problem: { businessProfileId },
        status: { notIn: ["WITHDRAWN"] },
      },
      data: {
        needsReview: formData.get("needsReview") === "on",
        businessReviewNote: note || null,
      },
    });
  } catch (error) {
    if (error instanceof Error) return { error: error.message };
    console.error("Cập nhật ghi chú hồ sơ thất bại:", error);
    return { error: "Không thể cập nhật ghi chú hồ sơ. Vui lòng thử lại." };
  }
  revalidatePath(`/business/problems/${problemId}/applications`);
  return { error: null };
}

export async function closeProblemAction(
  _previousState: ProblemActionState,
  formData: FormData,
): Promise<ProblemActionState> {
  const problemId = getText(formData, "problemId");
  try {
    const { userId, businessProfileId } = await getBusinessContext();
    await prisma.$transaction(async (transaction) => {
      const problem = await transaction.problem.findFirst({
        where: { id: problemId, businessProfileId, status: { in: ["APPROVED", "PUBLISHED"] } },
        select: { id: true, title: true },
      });
      if (!problem) throw new Error("Chỉ có thể đóng bài toán đã được duyệt và đang mở.");
      const pendingInvitation = await transaction.applicationInvitation.findFirst({
        where: { problemId, status: "PENDING_CONFIRMATION" },
        select: { id: true },
      });
      const runningProject = await transaction.project.findFirst({
        where: { application: { problemId }, status: { in: ["AGREEING", "IN_PROGRESS"] } },
        select: { id: true },
      });
      const selected = await transaction.application.findFirst({
        where: { problemId, status: "SELECTED" },
        select: { id: true },
      });
      const pendingReason = getBusinessCloseBlockReason({
        hasPendingInvitation: Boolean(pendingInvitation),
        hasSelectedApplication: Boolean(selected),
        hasRunningProject: Boolean(runningProject),
      });
      if (pendingReason) throw new Error(pendingReason);
      const affectedApplications = await transaction.application.findMany({
        where: { problemId, status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
        select: {
          id: true,
          team: {
            select: {
              ownerId: true,
              memberships: { select: { studentProfile: { select: { userId: true } } } },
            },
          },
        },
      });
      await transaction.application.updateMany({
        where: { problemId, status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
        data: { status: "NOT_SELECTED" },
      });
      const studentUserIds = [...new Set(
        affectedApplications.flatMap(({ team }) => [
          team.ownerId,
          ...team.memberships.map(({ studentProfile }) => studentProfile?.userId),
        ]).filter((userId): userId is string => Boolean(userId)),
      )];
      if (studentUserIds.length > 0) {
        await transaction.notification.createMany({
          data: studentUserIds.map((userId) => ({
            userId,
            title: "Bài toán đã đóng",
            message: `Bài toán “${problem.title}” đã được doanh nghiệp đóng và hồ sơ của nhóm không được chọn.`,
            href: `/student/problems/${problemId}`,
          })),
        });
      }
      await transaction.problem.update({
        where: { id: problemId },
        data: { status: "CLOSED", closedReason: "BUSINESS_CLOSED", closedAt: new Date() },
      });
      await transaction.auditLog.create({
        data: { actorId: userId, action: "BUSINESS_CLOSED_PROBLEM", targetType: "Problem", targetId: problemId, metadata: JSON.stringify({ title: problem.title }) },
      });
    });
  } catch (error) {
    if (error instanceof Error) return { error: error.message };
    console.error("Đóng bài toán thất bại:", error);
    return { error: "Không thể đóng bài toán. Vui lòng thử lại." };
  }
  revalidatePath("/business/problems");
  revalidatePath(`/business/problems/${problemId}`);
  return { error: null };
}
