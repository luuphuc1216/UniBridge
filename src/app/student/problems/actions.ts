"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStudent } from "@/lib/student-access";
import { getStudentDiscoverableProblemWhere } from "@/lib/problem-workflow";

function readText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function parseOptionalAmount(value: string, label: string): number | null {
  if (!value) {
    return null;
  }
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > 2_147_483_647) {
    throw new Error(`${label} phải là số tiền hợp lệ.`);
  }
  return amount;
}

export async function searchProblemsAction(formData: FormData): Promise<void> {
  const { userId } = await requireStudent();
  const query = readText(formData, "query").slice(0, 160);
  const field = readText(formData, "field").slice(0, 120);
  const skill = readText(formData, "skill").slice(0, 120);
  const duration = readText(formData, "duration").slice(0, 120);
  const budgetMin = parseOptionalAmount(readText(formData, "budgetMin"), "Ngân sách từ");
  const budgetMax = parseOptionalAmount(readText(formData, "budgetMax"), "Ngân sách đến");

  if (budgetMin !== null && budgetMax !== null && budgetMin > budgetMax) {
    throw new Error("Ngân sách từ không thể lớn hơn ngân sách đến.");
  }

  await prisma.searchLog.create({
    data: { userId, query, field: field || null, skill: skill || null, duration: duration || null, budgetMin, budgetMax },
  });

  const params = new URLSearchParams();
  if (query) params.set("query", query);
  if (field) params.set("field", field);
  if (skill) params.set("skill", skill);
  if (duration) params.set("duration", duration);
  if (budgetMin !== null) params.set("budgetMin", String(budgetMin));
  if (budgetMax !== null) params.set("budgetMax", String(budgetMax));
  redirect(`/student/problems${params.size ? `?${params.toString()}` : ""}`);
}

export type SavedProblemActionState = {
  error: string | null;
  message: string | null;
};

export async function toggleSavedProblemAction(
  _previousState: SavedProblemActionState,
  formData: FormData,
): Promise<SavedProblemActionState> {
  const { userId } = await requireStudent();
  const problemId = readText(formData, "problemId");
  const intent = readText(formData, "intent");
  if (!problemId || !["save", "remove"].includes(intent)) {
    return { error: "Thao tác lưu bài toán không hợp lệ.", message: null };
  }

  try {
    if (intent === "save") {
      const problem = await prisma.problem.findFirst({
        where: {
          id: problemId,
          ...getStudentDiscoverableProblemWhere(),
        },
        select: { id: true },
      });
      if (!problem) {
        return { error: "Bài toán không còn được công khai.", message: null };
      }
      await prisma.savedProblem.upsert({
        where: { userId_problemId: { userId, problemId } },
        update: {},
        create: { userId, problemId },
      });
    } else {
      await prisma.savedProblem.deleteMany({ where: { userId, problemId } });
    }
  } catch (error) {
    console.error("Cập nhật trạng thái lưu bài toán thất bại:", error);
    return {
      error: "Không thể cập nhật trạng thái lưu bài toán. Vui lòng thử lại.",
      message: null,
    };
  }

  revalidatePath("/student/problems");
  revalidatePath("/student/saved-problems");
  revalidatePath(`/student/problems/${problemId}`);
  return {
    error: null,
    message: intent === "save" ? "Đã lưu bài toán." : "Đã bỏ lưu bài toán.",
  };
}
