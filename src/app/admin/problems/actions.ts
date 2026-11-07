"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-access";
import { writeAuditLog } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";
import {
  getProblemReviewTransition,
  isValidProblemReviewNote,
  PROBLEM_REVIEWABLE_STATUS,
} from "@/lib/problem-workflow";
import { refundProblemCredit } from "@/lib/post-credits";
import {
  combineProblemReview,
  reviewProblemWithAi,
  saveAiReview,
} from "@/lib/ai/problem-review";
import {
  getAdminAiAssistFailure,
  getAdminAiAssistStatus,
  type AdminAiAssistStatus,
} from "@/lib/ai/admin-assist";

export type ReviewActionState = {
  error: string | null;
  aiStatus?: AdminAiAssistStatus;
  aiMessage?: string;
  aiResult?: {
    checklist: { key: string; passed: boolean; reason: string }[];
    conclusion: string;
    reason: string;
  };
};

const checklistFields = [
  "businessInfo",
  "problemDescription",
  "requirements",
  "field",
  "attachments",
  "policy",
] as const;

function getText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function reviewProblemAction(
  _previousState: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const { userId } = await requireAdmin();

  const problemId = getText(formData, "problemId");
  const decision = getText(formData, "decision");
  const nextStatus = getProblemReviewTransition(PROBLEM_REVIEWABLE_STATUS, decision);
  if (!problemId || !nextStatus) {
    return { error: "Yêu cầu kiểm duyệt không hợp lệ." };
  }

  const reviewNote = getText(formData, "reviewNote");
  if (decision !== "approve" && !isValidProblemReviewNote(reviewNote)) {
    return { error: "Vui lòng nhập lý do từ 3 đến 2.000 ký tự." };
  }
  if (
    decision === "approve" &&
    checklistFields.some((field) => formData.get(field) !== "on")
  ) {
    return { error: "Vui lòng hoàn thành đủ 6 mục trong checklist trước khi duyệt." };
  }

  const approved = decision === "approve";
  const rejected = decision === "reject";
  let updated: boolean;
  try {
    updated = await prisma.$transaction(async (transaction) => {
      const problem = await transaction.problem.findFirst({
        where: { id: problemId, status: PROBLEM_REVIEWABLE_STATUS },
        select: {
          id: true,
          title: true,
          firstApprovedAt: true,
          consumedCreditId: true,
          businessProfile: { select: { userId: true } },
        },
      });
      if (!problem) {
        return false;
      }

      const now = new Date();
      const result = await transaction.problem.updateMany({
        where: { id: problem.id, status: PROBLEM_REVIEWABLE_STATUS },
        data: {
          status: nextStatus,
          reviewedById: userId,
          reviewNote: approved ? null : reviewNote,
          approvedAt: approved ? now : null,
          ...(approved && !problem.firstApprovedAt ? { firstApprovedAt: now } : {}),
        },
      });
      if (result.count !== 1) {
        return false;
      }

      if (rejected && !problem.firstApprovedAt && problem.consumedCreditId) {
        await refundProblemCredit(transaction, { problemId: problem.id });
      }

      await transaction.notification.create({
        data: {
          userId: problem.businessProfile.userId,
          title: approved
            ? "Bài toán đã được duyệt"
            : rejected
              ? "Bài toán đã bị từ chối"
              : "Bài toán cần chỉnh sửa",
          message: approved
            ? `Bài toán “${problem.title}” đã được duyệt và công khai cho sinh viên.`
            : rejected
              ? `Bài toán “${problem.title}” đã bị từ chối: ${reviewNote}`
              : `Bài toán “${problem.title}” cần được chỉnh sửa: ${reviewNote}`,
          href: `/business/problems/${problem.id}`,
        },
      });
      await writeAuditLog(transaction, {
        actorId: userId,
        action: approved
          ? "PROBLEM_APPROVED"
          : rejected
            ? "PROBLEM_REJECTED"
            : "PROBLEM_REVISION_REQUESTED",
        targetType: "Problem",
        targetId: problem.id,
        metadata: { status: nextStatus },
      });
      return true;
    });
  } catch (error) {
    console.error("Kiểm duyệt bài toán thất bại:", error);
    return { error: "Không thể cập nhật kết quả kiểm duyệt. Vui lòng thử lại." };
  }

  if (!updated) {
    return { error: "Bài toán không còn ở trạng thái chờ duyệt. Hãy tải lại trang." };
  }

  revalidatePath("/admin/problems");
  revalidatePath(`/admin/problems/${problemId}`);
  revalidatePath("/business");
  revalidatePath("/business/problems");
  revalidatePath(`/business/problems/${problemId}`);
  revalidatePath("/student/problems");
  redirect("/admin/problems");
}

export async function runAiProblemReviewAction(
  _previousState: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  await requireAdmin();
  const problemId = getText(formData, "problemId");
  if (!problemId) return { error: "Yêu cầu kiểm tra AI không hợp lệ." };

  try {
    const problem = await prisma.problem.findUnique({
      where: { id: problemId },
      select: { businessProfileId: true },
    });
    if (!problem) throw new Error("Không tìm thấy bài toán.");
    const reviewed = await reviewProblemWithAi(problemId, problem.businessProfileId);
    const result = combineProblemReview(
      reviewed.rules,
      reviewed.kind === "AI" ? reviewed.ai : undefined,
    );
    const savedStatus = await prisma.$transaction(async (transaction) => {
      const currentProblem = await transaction.problem.findUnique({
        where: { id: problemId },
        select: { version: true },
      });
      if (!currentProblem) return null;

      const status = getAdminAiAssistStatus(
        reviewed.kind,
        reviewed.mapped.problemVersion,
        currentProblem.version,
      );
      await saveAiReview(transaction, {
        problemId,
        result,
        status:
          status === "AI"
            ? "COMPLETED"
            : status,
        problemVersion: reviewed.mapped.problemVersion,
      });
      return status;
    });
    if (savedStatus === null) {
      return { error: "Không tìm thấy bài toán để lưu kết quả kiểm tra." };
    }

    const aiMessage =
      savedStatus === "UNAVAILABLE"
        ? reviewed.kind === "AI_UNAVAILABLE"
          ? `AI hiện không khả dụng: ${reviewed.error}`
          : undefined
        : savedStatus === "RULES_ONLY"
          ? "Các nhận xét này đến từ kiểm tra theo quy tắc; chưa có phản hồi từ provider AI."
          : savedStatus === "STALE"
            ? "Bài toán đã thay đổi trong khi phân tích. Kết quả này thuộc phiên bản cũ, không dùng để quyết định hiện tại."
            : undefined;
    return {
      error: null,
      aiStatus: savedStatus,
      ...(aiMessage ? { aiMessage } : {}),
      aiResult: result,
    };
  } catch (error) {
    const failure = getAdminAiAssistFailure(error);
    return {
      error: failure.message,
      aiStatus: failure.status,
    };
  }
}

export async function overrideProblemReviewAction(
  _previousState: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const { userId } = await requireAdmin();
  const problemId = getText(formData, "problemId");
  const decision = getText(formData, "decision");
  const reviewNote = getText(formData, "reviewNote");
  const nextStatus =
    decision === "withdraw" ? "PENDING_REVIEW" : decision === "approve" ? "APPROVED" : decision === "reject" ? "REJECTED" : "NEEDS_REVISION";
  if (!problemId || (!isValidProblemReviewNote(reviewNote) && decision !== "approve" && decision !== "withdraw")) {
    return { error: "Vui lòng nhập lý do xử lý hợp lệ." };
  }
  try {
    await prisma.$transaction(async (transaction) => {
      const problem = await transaction.problem.findUnique({
        where: { id: problemId },
        select: {
          id: true,
          title: true,
          firstApprovedAt: true,
          consumedCreditId: true,
          businessProfile: { select: { userId: true } },
        },
      });
      if (!problem) throw new Error("Không tìm thấy bài toán.");
      const now = new Date();
      await transaction.problem.update({
        where: { id: problemId },
        data: {
          status: nextStatus,
          reviewedById: userId,
          reviewNote: decision === "approve" || decision === "withdraw" ? null : reviewNote,
          approvedAt: decision === "approve" ? now : null,
          ...(decision === "approve" && !problem.firstApprovedAt
            ? { firstApprovedAt: now }
            : {}),
        },
      });
      if (decision === "reject" && !problem.firstApprovedAt && problem.consumedCreditId) {
        await refundProblemCredit(transaction, { problemId });
      }
      await writeAuditLog(transaction, {
        actorId: userId,
        action: decision === "withdraw" ? "PROBLEM_APPROVAL_WITHDRAWN" : "PROBLEM_REVIEW_ADMIN_OVERRIDE",
        targetType: "Problem",
        targetId: problemId,
        metadata: { decision, status: nextStatus, reason: reviewNote },
      });
      await transaction.notification.create({
        data: {
          userId: problem.businessProfile.userId,
          title: decision === "withdraw" ? "Bài toán đã được thu hồi duyệt" : "Kết quả kiểm duyệt bài toán đã được cập nhật",
          message:
            decision === "approve"
              ? `Bài toán “${problem.title}” đã được quản trị viên duyệt lại.`
              : `Bài toán “${problem.title}” đã được quản trị viên cập nhật: ${reviewNote}`,
          href: `/business/problems/${problemId}`,
        },
      });
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Không thể ghi đè kết quả kiểm duyệt.",
    };
  }
  revalidatePath("/admin/problems");
  revalidatePath(`/admin/problems/${problemId}`);
  revalidatePath("/student/problems");
  redirect(`/admin/problems/${problemId}`);
}
