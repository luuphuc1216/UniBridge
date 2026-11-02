"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  businessFeeRate,
  studentFeeRate,
} from "@/lib/project-config";
import { findAccessibleProject, getProjectTeamUserIds } from "@/lib/project-access";
import {
  calculateProjectFinancialBreakdown,
  getMilestoneReleaseIdempotencyKey,
  shouldRecordMilestoneRelease,
} from "@/lib/project-money";
import {
  assertBusinessCanDeposit,
  recordProjectDeposit,
} from "@/lib/project-deposits";
import {
  acceptLegacyMilestone,
  acceptPaidMilestone,
  acceptProjectFinalCompletion,
  requestPaidMilestoneRevision,
  updatePaidMilestoneProgress,
} from "@/lib/project-milestone-workflow";
import {
  createProjectWithFirstAgreementVersion,
  getAgreementResponseMode,
  getAgreementErrorMessage,
  respondToLegacyProjectAgreement,
  respondToProjectAgreementVersion,
  saveProjectAgreementVersion,
  staleAgreementMessage,
  type AgreementVersionInput,
} from "@/lib/project-agreements";
import {
  createProjectChangeRequest,
  createProjectSupportNote,
  respondToProjectChangeRequest,
  resolveProjectDisputeForAdmin,
  type ProjectChangeKind,
  type ProjectChangeRequestResponse,
} from "@/lib/project-change-requests";
import { prisma } from "@/lib/prisma";
import { findAuthorizedWorkspace } from "@/lib/workspace-access";
import { getProjectNotificationHref } from "@/lib/project-notification-links";
import { assertProjectActionable } from "@/lib/project-milestone-workflow";

export type ProjectActionState = {
  error: string | null;
  success?: string | null;
  projectId?: string;
};

type AgreementMilestoneInput = {
  title: string;
  description: string;
  acceptanceCriteria: string;
  dueAt: string;
  paymentPercent: number;
};

type AgreementInput = {
  title: string;
  agreedScope: string;
  deliverables: string;
  duration: string;
  totalAmount: number;
  generalAcceptanceCriteria: string;
  businessResponsibilities: string;
  teamResponsibilities: string;
  paymentMethod: string;
  maxMilestoneRevisions: number;
  ownershipTerms: string;
  usageTerms: string;
  confidentialityTerms: string;
  extensionTerms: string;
  suspensionTerms: string;
  terminationTerms: string;
  disputeTerms: string;
  milestones: AgreementMilestoneInput[];
};

function parseDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? date
    : null;
}

function readText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseAgreement(formData: FormData, requireNewTerms = true): AgreementInput {
  const rawMilestones = readText(formData, "milestones");
  let milestones: AgreementMilestoneInput[];
  try {
    milestones = JSON.parse(rawMilestones) as AgreementMilestoneInput[];
  } catch {
    throw new Error("Danh sách Milestone không hợp lệ.");
  }
  if (!Array.isArray(milestones) || milestones.length === 0 || milestones.length > 20) {
    throw new Error("Thỏa thuận cần có từ 1 đến 20 Milestone.");
  }

  const input: AgreementInput = {
    title: readText(formData, "title"),
    agreedScope: readText(formData, "agreedScope"),
    deliverables: readText(formData, "deliverables"),
    duration: readText(formData, "duration"),
    totalAmount: Number(readText(formData, "totalAmount")),
    generalAcceptanceCriteria: readText(formData, "generalAcceptanceCriteria"),
    businessResponsibilities: readText(formData, "businessResponsibilities"),
    teamResponsibilities: readText(formData, "teamResponsibilities"),
    paymentMethod: readText(formData, "paymentMethod"),
    maxMilestoneRevisions: Number(readText(formData, "maxMilestoneRevisions")),
    ownershipTerms: readText(formData, "ownershipTerms"),
    usageTerms: readText(formData, "usageTerms"),
    confidentialityTerms: readText(formData, "confidentialityTerms"),
    extensionTerms: readText(formData, "extensionTerms"),
    suspensionTerms: readText(formData, "suspensionTerms"),
    terminationTerms: readText(formData, "terminationTerms"),
    disputeTerms: readText(formData, "disputeTerms"),
    milestones: milestones.map((milestone) => ({
      title: String(milestone.title ?? "").trim(),
      description: String(milestone.description ?? "").trim(),
      acceptanceCriteria: String(milestone.acceptanceCriteria ?? "").trim(),
      dueAt: String(milestone.dueAt ?? "").trim(),
      paymentPercent: Number(milestone.paymentPercent),
    })),
  };

  if (!input.title || input.title.length > 200) {
    throw new Error("Tên dự án phải có nội dung và không quá 200 ký tự.");
  }
  const requiredTexts = [
    input.agreedScope,
    input.deliverables,
    input.duration,
    input.generalAcceptanceCriteria,
    input.businessResponsibilities,
    input.teamResponsibilities,
    input.paymentMethod,
  ];
  if (requiredTexts.some((value) => !value || value.length > 10_000)) {
    throw new Error("Vui lòng điền đầy đủ các điều khoản (mỗi mục tối đa 10.000 ký tự).");
  }
  const versionedTerms = [
    input.ownershipTerms,
    input.usageTerms,
    input.confidentialityTerms,
    input.extensionTerms,
    input.suspensionTerms,
    input.terminationTerms,
    input.disputeTerms,
  ];
  if (
    requireNewTerms &&
    (versionedTerms.some((value) => !value || value.length > 10_000) ||
      !Number.isInteger(input.maxMilestoneRevisions) ||
      input.maxMilestoneRevisions < 0 ||
      input.maxMilestoneRevisions > 50)
  ) {
    throw new Error("Vui lòng điền đầy đủ điều khoản mới và số lần chỉnh sửa hợp lệ (0–50).");
  }
  if (!Number.isSafeInteger(input.totalAmount) || input.totalAmount <= 0) {
    throw new Error("Tổng chi phí phải là số nguyên VND lớn hơn 0.");
  }
  for (const milestone of input.milestones) {
    const dueAt = parseDateOnly(milestone.dueAt);
    if (
      !milestone.title ||
      milestone.title.length > 200 ||
      !milestone.description ||
      milestone.description.length > 4000 ||
      !milestone.acceptanceCriteria ||
      milestone.acceptanceCriteria.length > 4000 ||
      !dueAt ||
      !Number.isInteger(milestone.paymentPercent) ||
      milestone.paymentPercent <= 0 ||
      milestone.paymentPercent > 100
    ) {
      throw new Error("Mỗi Milestone cần tên, mô tả, hạn, tiêu chí nghiệm thu và % hợp lệ.");
    }
  }
  calculateProjectFinancialBreakdown(
    input.totalAmount,
    input.milestones.map((milestone) => milestone.paymentPercent),
    businessFeeRate,
    studentFeeRate,
  );
  return input;
}

function getVersionedAgreementInput(input: AgreementInput): AgreementVersionInput {
  return {
    title: input.title,
    agreedScope: input.agreedScope,
    deliverables: input.deliverables,
    duration: input.duration,
    totalAmount: input.totalAmount,
    generalAcceptanceCriteria: input.generalAcceptanceCriteria,
    businessResponsibilities: input.businessResponsibilities,
    teamResponsibilities: input.teamResponsibilities,
    paymentMethod: input.paymentMethod,
    maxMilestoneRevisions: input.maxMilestoneRevisions,
    ownershipTerms: input.ownershipTerms,
    usageTerms: input.usageTerms,
    confidentialityTerms: input.confidentialityTerms,
    extensionTerms: input.extensionTerms,
    suspensionTerms: input.suspensionTerms,
    terminationTerms: input.terminationTerms,
    disputeTerms: input.disputeTerms,
    milestones: input.milestones,
  };
}

function revalidateProject(projectId?: string, problemId?: string) {
  if (projectId) {
    revalidatePath(`/business/projects/${projectId}`);
    revalidatePath(`/student/projects/${projectId}`);
    revalidatePath(`/admin/projects/${projectId}`);
  }

  if (problemId) {
    revalidatePath(`/business/problems/${problemId}`);
    revalidatePath(`/business/problems/${problemId}/workspace`);
    revalidatePath(`/student/workspace/${problemId}`);
  }
  revalidatePath("/business/problems");
  revalidatePath("/student/applications");
  revalidatePath("/business/projects");
  revalidatePath("/student/projects");
  revalidatePath("/business/transactions");
  revalidatePath("/student/transactions");
}

function getActionError(error: unknown, operation: string): ProjectActionState {
  if (error instanceof Error) return { error: error.message };
  console.error(`${operation} thất bại:`, error);
  return { error: "Đã xảy ra lỗi. Vui lòng thử lại." };
}

async function requireProject(projectId: string) {
  const session = await auth();
  if (!session?.user || !["BUSINESS", "STUDENT"].includes(session.user.role)) {
    throw new Error("Vui lòng đăng nhập bằng tài khoản được cấp quyền.");
  }
  const project = await findAccessibleProject(
    projectId,
    session.user.id,
    session.user.role,
  );
  if (!project) throw new Error("Không tìm thấy dự án hoặc bạn không có quyền truy cập.");
  return { session, project };
}

const projectChangeKinds: ProjectChangeKind[] = [
  "EXTENSION",
  "PAUSE",
  "RESUME",
  "MILESTONE_CANCEL",
  "DISPUTE",
  "DISPUTE_RESOLUTION",
  "PROJECT_TERMINATION",
];

export async function createProjectChangeRequestAction(
  _previousState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const projectId = readText(formData, "projectId");
  try {
    const { session, project } = await requireProject(projectId);
    assertProjectActionable(project);
    const rawKind = readText(formData, "kind");
    if (!projectChangeKinds.includes(rawKind as ProjectChangeKind)) {
      throw new Error("Loại yêu cầu không hợp lệ.");
    }
    const dueAtValue = readText(formData, "dueAt");
    const daysValue = readText(formData, "days");
    const dueAt = dueAtValue ? new Date(dueAtValue) : null;
    if (dueAt && !Number.isFinite(dueAt.getTime())) throw new Error("Hạn mới không hợp lệ.");
    const days = daysValue ? Number(daysValue) : undefined;
    if (days !== undefined && !Number.isInteger(days)) throw new Error("Số ngày không hợp lệ.");
    await createProjectChangeRequest(prisma, {
      projectId,
      kind: rawKind as ProjectChangeKind,
      actorUserId: session.user.id,
      actorRole: session.user.role,
      reason: readText(formData, "reason"),
      milestoneId: readText(formData, "milestoneId") || null,
      proposedDueAt: dueAt,
      payload: {
        ...(dueAt ? { dueAt: dueAt.toISOString() } : {}),
        ...(days !== undefined ? { days } : {}),
      },
      idempotencyKey: readText(formData, "idempotencyKey") || randomUUID(),
    });
    revalidateProject(projectId, project.application.problem.id);
    return { error: null, success: "Đã gửi yêu cầu thay đổi để bên còn lại xác nhận.", projectId };
  } catch (error) {
    return getActionError(error, "Tạo yêu cầu thay đổi dự án");
  }
}

export async function respondToProjectChangeRequestAction(
  _previousState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const projectId = readText(formData, "projectId");
  try {
    const { session, project } = await requireProject(projectId);
    assertProjectActionable(project);
    const response = readText(formData, "response");
    if (response !== "ACCEPT" && response !== "REJECT") {
      throw new Error("Phản hồi yêu cầu không hợp lệ.");
    }
    const result = await respondToProjectChangeRequest(prisma, {
      requestId: readText(formData, "requestId"),
      actorUserId: session.user.id,
      actorRole: session.user.role,
      response: response as ProjectChangeRequestResponse,
    });
    revalidateProject(projectId, project.application.problem.id);
    if (result.status === "REJECTED") {
      return {
        error: "Không còn mốc chưa giải ngân; yêu cầu chấm dứt đã bị từ chối.",
        projectId,
      };
    }
    return { error: null, success: "Đã ghi nhận phản hồi yêu cầu thay đổi.", projectId };
  } catch (error) {
    return getActionError(error, "Phản hồi yêu cầu thay đổi dự án");
  }
}

export async function addProjectSupportNoteAction(
  _previousState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const projectId = readText(formData, "projectId");
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      throw new Error("Chỉ Admin mới có thể ghi chú hỗ trợ.");
    }
    const project = await findAccessibleProject(projectId, session.user.id, session.user.role);
    if (!project) throw new Error("Không tìm thấy dự án.");
    await createProjectSupportNote(prisma, {
      projectId,
      adminUserId: session.user.id,
      actorRole: session.user.role,
      note: readText(formData, "note"),
      milestoneId: readText(formData, "milestoneId") || undefined,
      changeRequestId: readText(formData, "changeRequestId") || undefined,
    });
    revalidatePath(`/admin/projects/${projectId}`);
    return { error: null, success: "Đã lưu ghi chú hỗ trợ.", projectId };
  } catch (error) {
    return getActionError(error, "Ghi chú hỗ trợ dự án");
  }
}

export async function resolveProjectDisputeForAdminAction(
  _previousState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const projectId = readText(formData, "projectId");
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      throw new Error("Chỉ Admin mới có thể hỗ trợ bất đồng.");
    }
    const project = await findAccessibleProject(projectId, session.user.id, session.user.role);
    if (!project) throw new Error("Không tìm thấy dự án.");
    const outcome = readText(formData, "outcome");
    if (outcome !== "RESUME_WORK" && outcome !== "GUIDE_TERMINATION") {
      throw new Error("Kết quả hỗ trợ bất đồng không hợp lệ.");
    }
    await resolveProjectDisputeForAdmin(prisma, {
      projectId,
      disputeRequestId: readText(formData, "disputeRequestId"),
      adminUserId: session.user.id,
      actorRole: session.user.role,
      outcome,
      reason: readText(formData, "reason"),
    });
    revalidateProject(projectId, project.application.problem.id);
    return { error: null, success: "Đã lưu kết quả hỗ trợ bất đồng.", projectId };
  } catch (error) {
    return getActionError(error, "Hỗ trợ bất đồng dự án");
  }
}

function projectRecipients(project: {
  team: {
    ownerId: string | null;
    memberships: { studentProfile: { userId: string } | null }[];
  };
  application: { problem: { businessProfile: { userId: string } } };
}) {
  return {
    businessUserId: project.application.problem.businessProfile.userId,
    teamUserIds: getProjectTeamUserIds(project.team),
  };
}

export async function saveAgreementAction(
  _previousState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const applicationId = readText(formData, "applicationId");
  const projectId = readText(formData, "projectId");
  const problemId = readText(formData, "problemId");
  const expectedVersionNumber = Number(readText(formData, "expectedVersionNumber") || "0");

  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "BUSINESS") {
      throw new Error("Chỉ doanh nghiệp sở hữu bài toán mới có thể soạn thỏa thuận.");
    }
    const workspace = await findAuthorizedWorkspace(
      problemId,
      session.user.id,
      session.user.role,
      applicationId,
    );
    const application = workspace?.applications[0];
    if (
      !workspace ||
      workspace.status !== "READY_FOR_IMPLEMENTATION" ||
      !application ||
      application.id !== applicationId
    ) {
      throw new Error("Bài toán không còn sẵn sàng tạo thỏa thuận.");
    }
    const existingBeforeSave = await prisma.project.findUnique({
      where: { applicationId },
      select: { id: true, legacyTermsExempt: true },
    });
    if (projectId && existingBeforeSave?.id !== projectId) {
      throw new Error("Không tìm thấy thỏa thuận cần cập nhật.");
    }
    const isLegacy = existingBeforeSave?.legacyTermsExempt ?? false;
    const input = parseAgreement(formData, !isLegacy);
    const breakdown = calculateProjectFinancialBreakdown(
      input.totalAmount,
      input.milestones.map(({ paymentPercent }) => paymentPercent),
      businessFeeRate,
      studentFeeRate,
    );

    const savedProject = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.project.findUnique({
        where: { applicationId },
        include: {
          transactions: { where: { type: "DEPOSIT" } },
          agreementVersions: {
            orderBy: { versionNumber: "desc" },
            take: 1,
            select: { versionNumber: true },
          },
        },
      });
      if (projectId && existing?.id !== projectId) {
        throw new Error("Không tìm thấy thỏa thuận cần cập nhật.");
      }
      if (existing && !existing.legacyTermsExempt) {
        await saveProjectAgreementVersion(transaction, {
          projectId: existing.id,
          expectedVersionNumber,
          createdByUserId: session.user.id,
          input: getVersionedAgreementInput(input),
          team: application.team,
        });
        return { id: existing.id, versioned: true };
      }
      if (
        existing &&
        (!["AGREEING", "AWAITING_PAYMENT"].includes(existing.status) ||
          existing.transactions.length > 0)
      ) {
        throw new Error("Thỏa thuận đã khóa, không thể chỉnh sửa.");
      }

      let savedProjectId: string;
      if (existing) {
        const changed = await transaction.project.updateMany({
          where: {
            id: existing.id,
            status: { in: ["AGREEING", "AWAITING_PAYMENT"] },
            transactions: { none: { type: "DEPOSIT" } },
          },
          data: {
            title: input.title,
            agreedScope: input.agreedScope,
            deliverables: input.deliverables,
            duration: input.duration,
            totalAmount: input.totalAmount,
            generalAcceptanceCriteria: input.generalAcceptanceCriteria,
            businessResponsibilities: input.businessResponsibilities,
            teamResponsibilities: input.teamResponsibilities,
            paymentMethod: input.paymentMethod,
            revisionNote: null,
            agreementRevision: { increment: 1 },
            businessAcceptedAt: null,
            teamAcceptedAt: null,
            status: "AGREEING",
          },
        });
        if (changed.count !== 1) {
          throw new Error("Thỏa thuận đã được nạp hoặc thay đổi trạng thái nên không thể sửa.");
        }
        await transaction.milestone.deleteMany({ where: { projectId: existing.id } });
        await transaction.milestone.createMany({
          data: input.milestones.map((milestone, index) => ({
            projectId: existing.id,
            title: milestone.title,
            description: milestone.description,
            acceptanceCriteria: milestone.acceptanceCriteria,
            paymentPercent: milestone.paymentPercent,
            amount: breakdown.milestones[index]?.grossAmount,
            dueAt: parseDateOnly(milestone.dueAt),
            sortOrder: index,
          })),
        });
        savedProjectId = existing.id;
      } else {
          const project = await createProjectWithFirstAgreementVersion(transaction, {
            applicationId,
            teamId: application.team.id,
            createdByUserId: session.user.id,
            input: getVersionedAgreementInput(input),
            team: application.team,
          });
          savedProjectId = project.id;
          return { id: savedProjectId, versioned: true };
      }

      await transaction.notification.createMany({
        data: [...new Set(getProjectTeamUserIds(application.team))].map((userId) => ({
          userId,
          title: existing ? "Doanh nghiệp đã cập nhật thỏa thuận" : "Doanh nghiệp đề nghị thỏa thuận dự án",
          message: `Vui lòng xem và phản hồi thỏa thuận dự án “${input.title}”.`,
          href: getProjectNotificationHref("STUDENT", savedProjectId),
        })),
      });
      return { id: savedProjectId, versioned: false };
    });

    revalidateProject(savedProject.id, problemId);
    return {
      error: null,
      success: savedProject.versioned
        ? "Đã gửi phiên bản thỏa thuận để nhóm xác nhận."
        : "Đã gửi thỏa thuận. Các xác nhận trước đây đã được làm mới.",
      projectId: savedProject.id,
    };
  } catch (error) {
    const staleMessage = getAgreementErrorMessage(error);
    if (error instanceof Error && error.message === staleAgreementMessage) {
      return { error: staleAgreementMessage };
    }
    if (staleMessage) return { error: staleMessage };
    return getActionError(error, "Lưu thỏa thuận");
  }
}

export async function respondAgreementAction(
  _previousState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const projectId = readText(formData, "projectId");
  const response = readText(formData, "response");
  const note = readText(formData, "note");
  const versionNumber = Number(readText(formData, "versionNumber"));

  try {
    const { session, project } = await requireProject(projectId);
    assertProjectActionable(project);
    const responseMode = getAgreementResponseMode({
      legacyTermsExempt: project.legacyTermsExempt,
      role: session.user.role,
      teamOwnerId: project.team.ownerId,
      actorUserId: session.user.id,
    });
    if (responseMode === "VERSIONED") {
      const isRetryOfAcceptedVersion =
        project.status === "AWAITING_PAYMENT" && response === "ACCEPT";
      if (project.status !== "AGREEING" && !isRetryOfAcceptedVersion) {
        throw new Error("Thỏa thuận hiện không chờ phản hồi.");
      }
      if (
        response !== "ACCEPT" &&
        response !== "REQUEST_CHANGES"
      ) {
        throw new Error("Phản hồi phiên bản thỏa thuận không hợp lệ.");
      }
      const result = await prisma.$transaction((transaction) =>
        respondToProjectAgreementVersion(transaction, {
          projectId,
          versionNumber,
          actorUserId: session.user.id,
          response,
          note,
        }),
      );
      revalidateProject(projectId, project.application.problem.id);
      return {
        error: null,
        success: result.awaitingPayment
          ? "Hai bên đã xác nhận cùng phiên bản. Dự án đang chờ nạp tiền giả lập."
          : response === "ACCEPT"
            ? "Đã xác nhận phiên bản thỏa thuận."
            : "Đã gửi đề nghị chỉnh sửa thỏa thuận.",
      };
    }
    if (project.status !== "AGREEING") {
      throw new Error("Thỏa thuận hiện không chờ phản hồi.");
    }
    if (response !== "ACCEPT" && response !== "REQUEST_CHANGES") {
      throw new Error("Phản hồi thỏa thuận không hợp lệ.");
    }
    await prisma.$transaction((transaction) =>
      respondToLegacyProjectAgreement(transaction, {
        projectId,
        actorUserId: session.user.id,
        role: session.user.role as "BUSINESS" | "STUDENT",
        response,
        note,
      }),
    );
    revalidateProject(projectId, project.application.problem.id);
    return { error: null, success: "Đã ghi nhận phản hồi thỏa thuận." };
  } catch (error) {
    const staleMessage = getAgreementErrorMessage(error);
    if (staleMessage) return { error: staleMessage };
    return getActionError(error, "Phản hồi thỏa thuận");
  }
}

export async function cancelProjectAction(
  _previousState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const projectId = readText(formData, "projectId");
  try {
    const { session, project } = await requireProject(projectId);
    assertProjectActionable(project);
    if (!["AGREEING", "AWAITING_PAYMENT"].includes(project.status)) {
      throw new Error("Chỉ có thể hủy dự án khi đang thỏa thuận hoặc chờ nạp tiền.");
    }
    const recipients = projectRecipients(project);
    await prisma.$transaction(async (transaction) => {
      const changed = await transaction.project.updateMany({
        where: {
          id: projectId,
          status: { in: ["AGREEING", "AWAITING_PAYMENT"] },
          transactions: { none: { type: "DEPOSIT" } },
        },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      });
      if (changed.count !== 1) {
        throw new Error("Không thể hủy sau khi dự án đã được nạp tiền hoặc thay đổi trạng thái.");
      }
      const recipientsToNotify =
        session.user.role === "BUSINESS"
          ? recipients.teamUserIds
          : [recipients.businessUserId];
      await transaction.notification.createMany({
        data: recipientsToNotify.map((userId) => ({
          userId,
          title: "Dự án đã bị hủy",
          message: `Dự án “${project.title}” đã bị hủy trước khi bắt đầu.`,
          href: getProjectNotificationHref(
            session.user.role === "BUSINESS" ? "STUDENT" : "BUSINESS",
            projectId,
          ),
        })),
      });
    });
    revalidateProject(projectId, project.application.problem.id);
    return { error: null, success: "Dự án đã được hủy." };
  } catch (error) {
    return getActionError(error, "Hủy dự án");
  }
}

export async function depositProjectAction(
  _previousState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const projectId = readText(formData, "projectId");
  let authorizedBusiness = false;
  try {
    const { session, project } = await requireProject(projectId);
    assertProjectActionable(project);
    assertBusinessCanDeposit(session.user.role);
    authorizedBusiness = true;
    const result = await recordProjectDeposit(prisma, { projectId });
    revalidateProject(projectId, project.application.problem.id);
    return {
      error: null,
      success: result.alreadyDeposited
        ? "Khoản nạp trước đó đã được ghi nhận."
        : "Đã ghi nhận khoản nạp giả lập và mở Milestone đầu tiên.",
    };
  } catch (error) {
    if (authorizedBusiness) {
      const existing = await prisma.projectTransaction.findUnique({
        where: { idempotencyKey: `deposit:${projectId}` },
        select: { id: true },
      });
      if (existing) {
        revalidateProject(projectId);
        return { error: null, success: "Khoản nạp trước đó đã được ghi nhận." };
      }
    }
    return getActionError(error, "Nạp tiền giả lập");
  }
}

export async function updateMilestoneProgressAction(
  _previousState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const projectId = readText(formData, "projectId");
  const milestoneId = readText(formData, "milestoneId");
  const progressNote = readText(formData, "progressNote");
  try {
    const { session, project } = await requireProject(projectId);
    assertProjectActionable(project);
    if (!project.legacyTermsExempt) {
      await updatePaidMilestoneProgress(prisma, {
        projectId,
        milestoneId,
        actorUserId: session.user.id,
        progressPercent: Number(readText(formData, "progressPercent")),
        workCompleted: readText(formData, "workCompleted"),
        difficulties: readText(formData, "difficulties"),
      });
      revalidateProject(projectId, project.application.problem.id);
      return { error: null, success: "Đã cập nhật tiến độ Milestone." };
    }
    if (!progressNote || progressNote.length > 4000) {
      return { error: "Cập nhật tiến độ cần có nội dung, tối đa 4.000 ký tự." };
    }
    if (session.user.role !== "STUDENT" || project.status !== "IN_PROGRESS") {
      throw new Error("Chỉ nhóm được chọn mới có thể cập nhật tiến độ dự án đang thực hiện.");
    }
    const milestone = project.milestones.find(({ id }) => id === milestoneId);
    if (!milestone || !["IN_PROGRESS", "REVISION_REQUESTED"].includes(milestone.status)) {
      throw new Error("Milestone này hiện chưa mở để cập nhật.");
    }
    if (
      project.milestones
        .filter(({ sortOrder }) => sortOrder < milestone.sortOrder)
        .some(({ status }) => status !== "ACCEPTED")
    ) {
      throw new Error("Cần nghiệm thu Milestone trước đó theo đúng thứ tự.");
    }
    const changed = await prisma.milestone.updateMany({
      where: {
        id: milestoneId,
        projectId,
        status: { in: ["IN_PROGRESS", "REVISION_REQUESTED"] },
      },
      data: { progressNote },
    });
    if (changed.count !== 1) throw new Error("Milestone đã thay đổi. Vui lòng tải lại.");
    revalidateProject(projectId, project.application.problem.id);
    return { error: null, success: "Đã cập nhật tiến độ." };
  } catch (error) {
    return getActionError(error, "Cập nhật tiến độ");
  }
}

export async function requestMilestoneRevisionAction(
  _previousState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const projectId = readText(formData, "projectId");
  const milestoneId = readText(formData, "milestoneId");
  const feedback = readText(formData, "feedback");
  if (!feedback || feedback.length > 4000) {
    return { error: "Vui lòng ghi rõ nội dung cần điều chỉnh (tối đa 4.000 ký tự)." };
  }
  try {
    const { session, project } = await requireProject(projectId);
    assertProjectActionable(project);
    if (!project.legacyTermsExempt) {
      if (session.user.role !== "BUSINESS") {
        throw new Error("Chỉ doanh nghiệp sở hữu mới có thể phản hồi Milestone.");
      }
      await requestPaidMilestoneRevision(prisma, {
        projectId,
        milestoneId,
        actorUserId: session.user.id,
        feedback,
      });
      revalidateProject(projectId, project.application.problem.id);
      return { error: null, success: "Đã gửi yêu cầu chỉnh sửa cho nhóm." };
    }
    if (session.user.role !== "BUSINESS" || project.status !== "IN_PROGRESS") {
      throw new Error("Chỉ doanh nghiệp sở hữu mới có thể phản hồi Milestone.");
    }
    const milestone = project.milestones.find(({ id }) => id === milestoneId);
    if (!milestone || milestone.status !== "SUBMITTED") {
      throw new Error("Chỉ có thể yêu cầu chỉnh sửa kết quả đang chờ nghiệm thu.");
    }
    if (
      project.milestones
        .filter(({ sortOrder }) => sortOrder < milestone.sortOrder)
        .some(({ status }) => status !== "ACCEPTED")
    ) {
      throw new Error("Cần xử lý Milestone trước đó theo đúng thứ tự.");
    }
    const recipients = projectRecipients(project);
    await prisma.$transaction(async (transaction) => {
      const changed = await transaction.milestone.updateMany({
        where: { id: milestoneId, projectId, status: "SUBMITTED" },
        data: { status: "REVISION_REQUESTED", revisionFeedback: feedback },
      });
      if (changed.count !== 1) throw new Error("Milestone đã được xử lý. Vui lòng tải lại.");
      await transaction.notification.createMany({
        data: recipients.teamUserIds.map((userId) => ({
          userId,
          title: "Doanh nghiệp yêu cầu chỉnh sửa Milestone",
          message: `Milestone “${milestone.title}” cần được điều chỉnh trong phạm vi đã thỏa thuận.`,
          href: getProjectNotificationHref("STUDENT", projectId),
        })),
      });
    });
    revalidateProject(projectId, project.application.problem.id);
    return { error: null, success: "Đã gửi yêu cầu chỉnh sửa cho nhóm." };
  } catch (error) {
    return getActionError(error, "Yêu cầu chỉnh sửa Milestone");
  }
}

export async function acceptMilestoneAction(
  _previousState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const projectId = readText(formData, "projectId");
  const milestoneId = readText(formData, "milestoneId");
  let authorizedBusiness = false;
  try {
    const { session, project } = await requireProject(projectId);
    assertProjectActionable(project);
    if (session.user.role !== "BUSINESS") {
      throw new Error("Chỉ doanh nghiệp sở hữu dự án mới có thể nghiệm thu.");
    }
    authorizedBusiness = true;
    if (!project.legacyTermsExempt) {
      const result = await acceptPaidMilestone(prisma, {
        projectId,
        milestoneId,
        actorUserId: session.user.id,
      });
      revalidateProject(projectId, project.application.problem.id);
      return {
        error: null,
        success: result.alreadyAccepted
          ? "Milestone này đã được nghiệm thu và giải ngân trước đó."
          : result.finalAcceptancePending
            ? "Đã nghiệm thu Milestone. Dự án đang chờ nghiệm thu cuối cùng."
            : "Đã nghiệm thu Milestone và ghi nhận giải ngân giả lập.",
      };
    }
    const result = await acceptLegacyMilestone(prisma, { projectId, milestoneId });
    revalidateProject(projectId, project.application.problem.id);
    return {
      error: null,
      success: result.alreadyAccepted
        ? "Milestone này đã được nghiệm thu và giải ngân trước đó."
        : "Đã nghiệm thu Milestone và ghi nhận giải ngân giả lập.",
    };
  } catch (error) {
    if (authorizedBusiness) {
      const existingRelease = await prisma.projectTransaction.findUnique({
        where: { idempotencyKey: getMilestoneReleaseIdempotencyKey(milestoneId) },
        select: { id: true },
      });
      if (!shouldRecordMilestoneRelease(existingRelease)) {
        revalidateProject(projectId);
        return { error: null, success: "Milestone này đã được nghiệm thu và giải ngân trước đó." };
      }
    }

    return getActionError(error, "Nghiệm thu Milestone");
  }
}

export async function acceptProjectFinalCompletionAction(
  _previousState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const projectId = readText(formData, "projectId");
  try {
    const { session, project } = await requireProject(projectId);
    assertProjectActionable(project);
    if (session.user.role !== "BUSINESS") {
      throw new Error("Chỉ doanh nghiệp sở hữu dự án mới có thể xác nhận hoàn tất.");
    }
    if (project.legacyTermsExempt) {
      throw new Error("Dự án legacy giữ nguyên luồng nghiệm thu hiện tại.");
    }
    const result = await acceptProjectFinalCompletion(prisma, {
      projectId,
      actorUserId: session.user.id,
    });
    revalidateProject(projectId, project.application.problem.id);
    return {
      error: null,
      success: result.alreadyCompleted
        ? "Dự án đã được xác nhận hoàn tất trước đó."
        : "Đã xác nhận nghiệm thu cuối cùng. Dự án đã hoàn tất.",
    };
  } catch (error) {
    return getActionError(error, "Nghiệm thu cuối cùng");
  }
}
