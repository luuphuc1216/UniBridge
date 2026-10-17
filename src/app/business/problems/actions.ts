"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { MAX_ATTACHMENT_COUNT } from "@/lib/business-attachments/config";
import { validateAttachment } from "@/lib/business-attachments/validation";
import { prisma } from "@/lib/prisma";
import { attachmentStorage } from "@/lib/storage";

export type ProblemActionState = {
  error: string | null;
};

function getText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
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
  return { businessProfileId: profile.id };
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
    const intent = getText(formData, "intent");
    const status = intent === "submit" ? "PENDING_REVIEW" : "DRAFT";

    const problem = await prisma.problem.create({
      data: {
        ...fields,
        businessProfileId,
        slug: makeSlug(fields.title),
        status,
        submittedAt: status === "PENDING_REVIEW" ? new Date() : null,
        attachments: {
          create: stored,
        },
      },
      select: { id: true },
    });
    problemId = problem.id;
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
    if (error instanceof Error) {
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

  try {
    const { businessProfileId } = await getBusinessContext();
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

    const shouldSubmit = getText(formData, "intent") === "submit";
    const nextStatus = shouldSubmit ? "PENDING_REVIEW" : problem.status;
    await prisma.$transaction(async (transaction) => {
      await transaction.problem.update({
        where: { id: problemId },
        data: {
          ...fields,
          status: nextStatus,
          ...(shouldSubmit
            ? {
                reviewNote: null,
                reviewedById: null,
                approvedAt: null,
                submittedAt: new Date(),
              }
            : {}),
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
    if (error instanceof Error) {
      return { error: error.message };
    }
    console.error("Cập nhật Problem thất bại:", error);
    return { error: "Không thể cập nhật bài toán. Vui lòng thử lại." };
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
        where: { id: applicationId, problemId, status: "SUBMITTED" },
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
        throw new Error("Hồ sơ ứng tuyển không còn khả dụng.");
      }

      await transaction.problem.update({
        where: { id: problemId },
        data: { status: "TEAM_SELECTED" },
      });
      await transaction.application.updateMany({
        where: { problemId, id: { not: applicationId }, status: "SUBMITTED" },
        data: { status: "REJECTED" },
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
          message: "Bắt đầu làm việc trong không gian chung để phát triển Prototype / Solution Proposal.",
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
