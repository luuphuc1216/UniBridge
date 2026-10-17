"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { MAX_PROPOSAL_FILE_COUNT, MAX_PROPOSAL_FILE_TOTAL_BYTES } from "@/lib/business-attachments/config";
import { validateAttachment } from "@/lib/business-attachments/validation";
import { prisma } from "@/lib/prisma";
import { attachmentStorage } from "@/lib/storage";
import { findAuthorizedWorkspace, isFinalWorkspaceStatus } from "@/lib/workspace-access";
import {
  proposalEvaluationFields,
  proposalTypes,
} from "@/lib/workspace";

export type WorkspaceActionState = { error: string | null };

function readText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function requireWorkspace(problemId: string) {
  const session = await auth();
  if (!session?.user || !["BUSINESS", "STUDENT"].includes(session.user.role)) {
    throw new Error("Vui lòng đăng nhập bằng tài khoản được cấp quyền.");
  }
  const workspace = await findAuthorizedWorkspace(
    problemId,
    session.user.id,
    session.user.role,
  );
  if (!workspace) {
    throw new Error("Không tìm thấy không gian làm việc.");
  }
  const application = workspace.applications[0];
  if (!application) {
    throw new Error("Không tìm thấy nhóm được chọn.");
  }
  return { session, workspace, application };
}

function revalidateWorkspace(problemId: string) {
  revalidatePath(`/business/problems/${problemId}`);
  revalidatePath(`/business/problems/${problemId}/workspace`);
  revalidatePath(`/student/workspace/${problemId}`);
  revalidatePath("/student/applications");
  revalidatePath("/business/problems");
}

function getTeamUserIds(application: {
  team: {
    ownerId: string | null;
    memberships: { studentProfile: { userId: string } | null }[];
  };
}) {
  return [
    application.team.ownerId,
    ...application.team.memberships.map(({ studentProfile }) => studentProfile?.userId),
  ].filter((id): id is string => Boolean(id));
}

function actionError(error: unknown, operation: string): WorkspaceActionState {
  if (error instanceof Error) {
    return { error: error.message };
  }
  console.error(`${operation} thất bại:`, error);
  return { error: "Đã xảy ra lỗi. Vui lòng thử lại." };
}

export async function startWorkspaceAction(
  _previousState: WorkspaceActionState,
  formData: FormData,
): Promise<WorkspaceActionState> {
  const problemId = readText(formData, "problemId");
  try {
    const { session, workspace } = await requireWorkspace(problemId);
    if (session.user.role !== "STUDENT") {
      throw new Error("Chỉ nhóm được chọn mới có thể bắt đầu.");
    }
    if (workspace.status !== "TEAM_SELECTED") {
      throw new Error("Bài toán không còn ở trạng thái chờ bắt đầu.");
    }
    const changed = await prisma.problem.updateMany({
      where: {
        id: problemId,
        status: "TEAM_SELECTED",
        applications: { some: { status: "SELECTED" } },
      },
      data: { status: "PROTOTYPING" },
    });
    if (changed.count !== 1) {
      throw new Error("Trạng thái bài toán đã thay đổi. Vui lòng tải lại trang.");
    }
  } catch (error) {
    return actionError(error, "Bắt đầu không gian làm việc");
  }
  revalidateWorkspace(problemId);
  return { error: null };
}

export async function sendWorkspaceMessageAction(
  _previousState: WorkspaceActionState,
  formData: FormData,
): Promise<WorkspaceActionState> {
  const problemId = readText(formData, "problemId");
  const content = readText(formData, "content");
  if (!content || content.length > 4000) {
    return { error: "Tin nhắn phải có nội dung và không vượt quá 4.000 ký tự." };
  }
  try {
    const { session, workspace, application } = await requireWorkspace(problemId);
    if (isFinalWorkspaceStatus(workspace.status)) {
      throw new Error("Không thể gửi tin nhắn sau khi doanh nghiệp đã quyết định.");
    }
    await prisma.$transaction(async (transaction) => {
      const currentProblem = await transaction.problem.findFirst({
        where: {
          id: problemId,
          status: { in: ["TEAM_SELECTED", "PROTOTYPING", "EVALUATING"] },
          applications: { some: { id: application.id, status: "SELECTED" } },
        },
        select: { id: true },
      });
      if (!currentProblem) {
        throw new Error("Không thể gửi tin nhắn sau khi doanh nghiệp đã quyết định.");
      }
      await transaction.workspaceMessage.create({
        data: { problemId, senderId: session.user.id, content },
      });
      const isBusiness = session.user.role === "BUSINESS";
      const recipients = isBusiness
        ? getTeamUserIds(application)
        : [workspace.businessProfile.userId];
      await transaction.notification.createMany({
        data: [...new Set(recipients)].map((userId) => ({
          userId,
          title: "Có tin nhắn mới trong không gian làm việc",
          message: `Có tin nhắn mới về bài toán “${workspace.title}”.`,
          href: isBusiness
            ? `/student/workspace/${problemId}`
            : `/business/problems/${problemId}/workspace`,
        })),
      });
    });
  } catch (error) {
    return actionError(error, "Gửi tin nhắn");
  }
  revalidateWorkspace(problemId);
  return { error: null };
}

export async function submitProposalAction(
  _previousState: WorkspaceActionState,
  formData: FormData,
): Promise<WorkspaceActionState> {
  const problemId = readText(formData, "problemId");
  const type = readText(formData, "type");
  const description = readText(formData, "description");
  if (!proposalTypes.some((proposalType) => proposalType === type)) {
    return { error: "Vui lòng chọn loại Proposal hợp lệ." };
  }
  if (!description || description.length > 10_000) {
    return { error: "Mô tả phải có nội dung và không vượt quá 10.000 ký tự." };
  }

  const uploadedFiles = formData
    .getAll("files")
    .filter((file): file is File => file instanceof File && (file.size > 0 || file.name !== ""));
  if (uploadedFiles.length > MAX_PROPOSAL_FILE_COUNT) {
    return { error: `Mỗi phiên bản được đính kèm tối đa ${MAX_PROPOSAL_FILE_COUNT} tệp.` };
  }

  const storedKeys: string[] = [];
  try {
    const { session, workspace, application } = await requireWorkspace(problemId);
    if (session.user.role !== "STUDENT") {
      throw new Error("Chỉ nhóm được chọn mới có thể nộp Proposal.");
    }
    if (workspace.status !== "PROTOTYPING") {
      throw new Error("Chỉ có thể nộp Proposal khi bài toán đang ở giai đoạn xây dựng.");
    }
    const validatedFiles = await Promise.all(uploadedFiles.map(validateAttachment));
    if (
      validatedFiles.reduce((total, file) => total + file.sizeBytes, 0) >
      MAX_PROPOSAL_FILE_TOTAL_BYTES
    ) {
      throw new Error("Tổng dung lượng tệp đính kèm vượt quá giới hạn cho phép.");
    }
    for (const file of validatedFiles) {
      const storageKey = randomUUID();
      storedKeys.push(storageKey);
      await attachmentStorage.save(storageKey, file.content);
    }

    await prisma.$transaction(async (transaction) => {
      const currentProblem = await transaction.problem.findFirst({
        where: {
          id: problemId,
          status: "PROTOTYPING",
          applications: { some: { id: application.id, status: "SELECTED" } },
        },
        select: { id: true },
      });
      if (!currentProblem) {
        throw new Error("Bài toán không còn nhận Proposal.");
      }
      const latest = await transaction.proposal.aggregate({
        where: { applicationId: application.id },
        _max: { version: true },
      });
      const version = (latest._max.version ?? 0) + 1;
      await transaction.proposal.create({
        data: {
          applicationId: application.id,
          version,
          type,
          description,
          files: {
            create: validatedFiles.map((file, index) => ({
              originalName: file.originalName,
              contentType: file.contentType,
              sizeBytes: file.sizeBytes,
              storageKey: storedKeys[index],
            })),
          },
        },
      });
      const changed = await transaction.problem.updateMany({
        where: {
          id: problemId,
          status: "PROTOTYPING",
          applications: { some: { id: application.id, status: "SELECTED" } },
        },
        data: { status: "EVALUATING" },
      });
      if (changed.count !== 1) {
        throw new Error("Trạng thái bài toán đã thay đổi. Vui lòng tải lại trang.");
      }
      await transaction.notification.create({
        data: {
          userId: workspace.businessProfile.userId,
          title: "Nhóm đã nộp Proposal để đánh giá",
          message: `Nhóm đã nộp phiên bản ${version} cho bài toán “${workspace.title}”.`,
          href: `/business/problems/${problemId}/workspace`,
        },
      });
    });
  } catch (error) {
    await Promise.all(
      storedKeys.map(async (storageKey) => {
        try {
          await attachmentStorage.delete(storageKey);
        } catch (cleanupError) {
          console.error("Không thể dọn tệp Proposal sau lỗi:", cleanupError);
        }
      }),
    );
    return actionError(error, "Nộp Proposal");
  }
  revalidateWorkspace(problemId);
  return { error: null };
}

export async function evaluateProposalAction(
  _previousState: WorkspaceActionState,
  formData: FormData,
): Promise<WorkspaceActionState> {
  const problemId = readText(formData, "problemId");
  const proposalId = readText(formData, "proposalId");
  const decision = readText(formData, "decision");
  const comment = readText(formData, "comment");
  if (!["CHANGES_REQUESTED", "CLOSED", "READY_FOR_IMPLEMENTATION"].includes(decision)) {
    return { error: "Quyết định đánh giá không hợp lệ." };
  }
  if (!comment || comment.length > 4000) {
    return { error: "Vui lòng ghi nhận xét (tối đa 4.000 ký tự)." };
  }
  const scores: number[] = [];
  for (const [field] of proposalEvaluationFields) {
    const value = Number(readText(formData, field));
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      return { error: "Mỗi tiêu chí cần được chấm từ 1 đến 5." };
    }
    scores.push(value);
  }

  try {
    const { session, workspace, application } = await requireWorkspace(problemId);
    if (session.user.role !== "BUSINESS") {
      throw new Error("Chỉ doanh nghiệp sở hữu bài toán mới có thể đánh giá.");
    }
    if (workspace.status !== "EVALUATING") {
      throw new Error("Bài toán hiện không chờ doanh nghiệp đánh giá.");
    }
    await prisma.$transaction(async (transaction) => {
      const proposal = await transaction.proposal.findFirst({
        where: {
          id: proposalId,
          applicationId: application.id,
          status: "SUBMITTED",
        },
        select: { id: true },
      });
      if (!proposal) {
        throw new Error("Không tìm thấy Proposal đang chờ đánh giá.");
      }
      const updatedProblem = await transaction.problem.updateMany({
        where: {
          id: problemId,
          status: "EVALUATING",
          applications: { some: { id: application.id, status: "SELECTED" } },
        },
        data: {
          status:
            decision === "CHANGES_REQUESTED"
              ? "PROTOTYPING"
              : decision,
        },
      });
      if (updatedProblem.count !== 1) {
        throw new Error("Trạng thái bài toán đã thay đổi. Vui lòng tải lại trang.");
      }
      const updatedProposal = await transaction.proposal.updateMany({
        where: {
          id: proposalId,
          applicationId: application.id,
          status: "SUBMITTED",
        },
        data: {
          status:
            decision === "CHANGES_REQUESTED"
              ? "CHANGES_REQUESTED"
              : decision === "CLOSED"
                ? "NOT_IMPLEMENTED"
                : "ACCEPTED",
        },
      });
      if (updatedProposal.count !== 1) {
        throw new Error("Proposal đã được đánh giá. Vui lòng tải lại trang.");
      }
      await transaction.proposalEvaluation.create({
        data: {
          proposalId,
          problemResponse: scores[0],
          feasibility: scores[1],
          goalAlignment: scores[2],
          practicalImplementation: scores[3],
          estimatedCost: scores[4],
          implementationTime: scores[5],
          valueDelivered: scores[6],
          comment,
          decision,
        },
      });
      await transaction.notification.createMany({
        data: [...new Set(getTeamUserIds(application))].map((userId) => ({
          userId,
          title:
            decision === "CHANGES_REQUESTED"
              ? "Doanh nghiệp yêu cầu chỉnh sửa Proposal"
              : decision === "CLOSED"
                ? "Doanh nghiệp đã quyết định không triển khai"
                : "Doanh nghiệp sẵn sàng triển khai giải pháp",
          message: `Doanh nghiệp đã đánh giá Proposal của bài toán “${workspace.title}”.`,
          href: `/student/workspace/${problemId}`,
        })),
      });
    });
  } catch (error) {
    return actionError(error, "Đánh giá Proposal");
  }
  revalidateWorkspace(problemId);
  return { error: null };
}
