"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type ReviewActionState = {
  error: string | null;
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
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { error: "Bạn không có quyền thực hiện thao tác này." };
  }

  const problemId = getText(formData, "problemId");
  const decision = getText(formData, "decision");
  if (!problemId || !["approve", "requestRevision"].includes(decision)) {
    return { error: "Yêu cầu kiểm duyệt không hợp lệ." };
  }

  const reviewNote = getText(formData, "reviewNote");
  if (decision === "requestRevision" && (reviewNote.length < 3 || reviewNote.length > 2000)) {
    return { error: "Vui lòng nhập lý do từ 3 đến 2.000 ký tự." };
  }
  if (
    decision === "approve" &&
    checklistFields.some((field) => formData.get(field) !== "on")
  ) {
    return { error: "Vui lòng hoàn thành đủ 6 mục trong checklist trước khi duyệt." };
  }

  const approved = decision === "approve";
  let updated: boolean;
  try {
    updated = await prisma.$transaction(async (transaction) => {
      const problem = await transaction.problem.findFirst({
        where: { id: problemId, status: "PENDING_REVIEW" },
        select: {
          id: true,
          title: true,
          businessProfile: { select: { userId: true } },
        },
      });
      if (!problem) {
        return false;
      }

      const now = new Date();
      const result = await transaction.problem.updateMany({
        where: { id: problem.id, status: "PENDING_REVIEW" },
        data: {
          status: approved ? "APPROVED" : "NEEDS_REVISION",
          reviewedById: session.user.id,
          reviewNote: approved ? null : reviewNote,
          approvedAt: approved ? now : null,
        },
      });
      if (result.count !== 1) {
        return false;
      }

      await transaction.notification.create({
        data: {
          userId: problem.businessProfile.userId,
          title: approved ? "Bài toán đã được duyệt" : "Bài toán cần chỉnh sửa",
          message: approved
            ? `Bài toán “${problem.title}” đã được duyệt và công khai cho sinh viên.`
            : `Bài toán “${problem.title}” cần được chỉnh sửa: ${reviewNote}`,
          href: `/business/problems/${problem.id}`,
        },
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
