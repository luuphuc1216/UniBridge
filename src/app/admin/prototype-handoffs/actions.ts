"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdminRole } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { reviewProposalHandoff } from "@/lib/proposal-handoff";

export type ProposalHandoffActionState = { error: string | null };

function readText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readBoolean(formData: FormData, key: string): boolean {
  const value = readText(formData, key);
  if (value !== "true" && value !== "false") {
    throw new Error("Vui lòng chọn Đạt hoặc Chưa đạt cho cả ba mục.");
  }
  return value === "true";
}

export async function reviewProposalHandoffAction(
  _previousState: ProposalHandoffActionState,
  formData: FormData,
): Promise<ProposalHandoffActionState> {
  const session = await auth();
  if (!session?.user || !isAdminRole(session.user.role)) {
    return { error: "Chỉ quản trị viên mới được kiểm tra bàn giao Proposal." };
  }

  const attemptId = readText(formData, "attemptId");
  const decision = readText(formData, "decision");
  const problemId = readText(formData, "problemId");
  try {
    if (decision !== "APPROVED" && decision !== "RETURNED") {
      throw new Error("Kết quả kiểm tra bàn giao không hợp lệ.");
    }
    await prisma.$transaction((transaction) =>
      reviewProposalHandoff(transaction, {
        attemptId,
        reviewerId: session.user.id,
        reviewerRole: session.user.role,
        decision,
        filesOrLinksComplete: readBoolean(formData, "filesOrLinksComplete"),
        withinTrialBriefScope: readBoolean(formData, "withinTrialBriefScope"),
        compliesWithRules: readBoolean(formData, "compliesWithRules"),
        note: readText(formData, "note"),
        missingItems: readText(formData, "missingItems")
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
      }),
    );
  } catch (error) {
    if (!(error instanceof Error)) {
      console.error("Kiểm tra bàn giao Proposal thất bại:", error);
    }
    return {
      error: error instanceof Error ? error.message : "Không thể lưu kết quả kiểm tra bàn giao.",
    };
  }
  revalidatePath("/admin/prototype-handoffs");
  revalidatePath(`/admin/prototype-handoffs/${attemptId}`);
  revalidatePath(`/business/problems/${problemId}/workspace`);
  revalidatePath(`/student/workspace/${problemId}`);
  redirect(`/admin/prototype-handoffs?result=${decision === "APPROVED" ? "approved" : "returned"}`);
}
