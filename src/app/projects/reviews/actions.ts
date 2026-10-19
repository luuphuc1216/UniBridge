"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { Prisma } from "@/generated/prisma/client";
import { findAccessibleProject, getProjectTeamUserIds } from "@/lib/project-access";
import { reputationConfig, type ReviewDirection } from "@/lib/reputation-config";
import { prisma } from "@/lib/prisma";

export type ReviewActionState = {
  error: string | null;
  success?: string | null;
};

function readText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseReview(
  formData: FormData,
  direction: ReviewDirection,
): { rating: number; criteriaScores: Record<string, number>; content: string } {
  const criteria = reputationConfig.criteria[direction];
  const criteriaScores = Object.fromEntries(
    criteria.map(({ key }) => {
      const score = Number(readText(formData, `score_${key}`));
      if (!Number.isInteger(score) || score < 1 || score > 5) {
        throw new Error("Hãy chấm điểm từ 1 đến 5 cho từng tiêu chí.");
      }
      return [key, score];
    }),
  );
  const content = readText(formData, "content");
  if (!content || content.length > 3000) {
    throw new Error("Nhận xét cần có nội dung và không quá 3.000 ký tự.");
  }
  const scores = Object.values(criteriaScores);
  return {
    rating: Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 100) / 100,
    criteriaScores,
    content,
  };
}

export async function submitProjectReviewAction(
  _previousState: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const projectId = readText(formData, "projectId");
  try {
    const session = await auth();
    if (!session?.user) throw new Error("Vui lòng đăng nhập để đánh giá.");
    if (!projectId) throw new Error("Không tìm thấy dự án.");

    const direction: ReviewDirection =
      session.user.role === "BUSINESS"
        ? "BUSINESS_TO_TEAM"
        : session.user.role === "STUDENT"
          ? "TEAM_TO_BUSINESS"
          : (() => {
              throw new Error("Vai trò này không thể đánh giá dự án.");
            })();
    const project = await findAccessibleProject(projectId, session.user.id, session.user.role);
    if (!project) throw new Error("Bạn không có quyền truy cập dự án này.");
    if (project.status !== "COMPLETED" || !project.completedAt) {
      throw new Error("Chỉ có thể đánh giá sau khi dự án hoàn tất.");
    }
    const review = parseReview(formData, direction);
    const reviewerLabel =
      direction === "BUSINESS_TO_TEAM" ? "Doanh nghiệp" : "Nhóm sinh viên";
    const teamUserIds = getProjectTeamUserIds(project.team);
    const recipients =
      direction === "BUSINESS_TO_TEAM"
        ? teamUserIds
        : [project.application.problem.businessProfile.userId];

    await prisma.$transaction(async (transaction) => {
      const currentProject = await transaction.project.findFirst({
        where: { id: projectId, status: "COMPLETED", completedAt: { not: null } },
        select: { id: true },
      });
      if (!currentProject) throw new Error("Dự án chưa hoàn tất hoặc đã thay đổi trạng thái.");
      const existing = await transaction.review.findUnique({
        where: { projectId_direction: { projectId, direction } },
        select: { id: true },
      });
      if (existing) throw new Error("Phía bạn đã gửi đánh giá cho dự án này.");

      await transaction.review.create({
        data: {
          projectId,
          reviewerId: session.user.id,
          direction,
          reviewedTeamId:
            direction === "BUSINESS_TO_TEAM" ? project.team.id : null,
          reviewedBusinessProfileId:
            direction === "TEAM_TO_BUSINESS"
              ? project.application.problem.businessProfile.id
              : null,
          rating: review.rating,
          criteriaScores: JSON.stringify(review.criteriaScores),
          content: review.content,
        },
      });

      if (direction === "BUSINESS_TO_TEAM") {
        const aggregate = await transaction.review.aggregate({
          where: { reviewedTeamId: project.team.id, direction: "BUSINESS_TO_TEAM" },
          _avg: { rating: true },
          _count: { _all: true },
        });
        await transaction.studentTeam.update({
          where: { id: project.team.id },
          data: {
            ratingAverage: aggregate._avg.rating ?? 0,
            ratingCount: aggregate._count._all,
          },
        });
      }

      await transaction.notification.createMany({
        data: recipients.map((userId) => ({
          userId,
          title: "Có đánh giá mới",
          message: `Một bên đã gửi đánh giá cho dự án “${project.title}”. Nội dung chỉ hiển thị khi cả hai bên đã gửi hoặc hết thời hạn chờ.`,
          href:
            direction === "BUSINESS_TO_TEAM"
              ? `/student/projects/${projectId}`
              : `/business/projects/${projectId}`,
        })),
      });
    });

    revalidatePath(`/business/projects/${projectId}`);
    revalidatePath(`/student/projects/${projectId}`);
    revalidatePath("/student/team");
    revalidatePath(`/teams/${project.team.id}`);
    revalidatePath(`/businesses/${project.application.problem.businessProfile.id}`);
    return {
      error: null,
      success: `Đã gửi đánh giá với vai trò ${reviewerLabel.toLowerCase()}.`,
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: "Phía bạn đã gửi đánh giá cho dự án này." };
    }
    if (error instanceof Error) return { error: error.message };
    console.error("Gửi đánh giá dự án thất bại:", error);
    return { error: "Không thể gửi đánh giá. Vui lòng thử lại." };
  }
}
