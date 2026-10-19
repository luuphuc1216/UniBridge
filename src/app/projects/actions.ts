"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  businessFeeRate,
  legacyPlatformFeeRate,
  studentFeeRate,
} from "@/lib/project-config";
import { findAccessibleProject, getProjectTeamUserIds } from "@/lib/project-access";
import {
  calculateLegacyProjectFinancialBreakdown,
  calculateProjectFinancialBreakdown,
  getMilestoneReleaseIdempotencyKey,
  shouldRecordMilestoneRelease,
} from "@/lib/project-money";
import { prisma } from "@/lib/prisma";
import { findAuthorizedWorkspace } from "@/lib/workspace-access";

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

function parseAgreement(formData: FormData): AgreementInput {
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

function revalidateProject(projectId?: string, problemId?: string) {
  if (projectId) {
    revalidatePath(`/business/projects/${projectId}`);
    revalidatePath(`/student/projects/${projectId}`);
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

  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "BUSINESS") {
      throw new Error("Chỉ doanh nghiệp sở hữu bài toán mới có thể soạn thỏa thuận.");
    }
    const workspace = await findAuthorizedWorkspace(
      problemId,
      session.user.id,
      session.user.role,
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
    const input = parseAgreement(formData);
    const breakdown = calculateProjectFinancialBreakdown(
      input.totalAmount,
      input.milestones.map(({ paymentPercent }) => paymentPercent),
      businessFeeRate,
      studentFeeRate,
    );

    const savedProject = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.project.findUnique({
        where: { applicationId },
        include: { transactions: { where: { type: "DEPOSIT" } } },
      });
      if (projectId && existing?.id !== projectId) {
        throw new Error("Không tìm thấy thỏa thuận cần cập nhật.");
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
        const project = await transaction.project.create({
            data: {
              applicationId,
              teamId: application.team.id,
              title: input.title,
              agreedScope: input.agreedScope,
              deliverables: input.deliverables,
              duration: input.duration,
              totalAmount: input.totalAmount,
              generalAcceptanceCriteria: input.generalAcceptanceCriteria,
              businessResponsibilities: input.businessResponsibilities,
              teamResponsibilities: input.teamResponsibilities,
              paymentMethod: input.paymentMethod,
              status: "AGREEING",
              milestones: {
                create: input.milestones.map((milestone, index) => ({
                  title: milestone.title,
                  description: milestone.description,
                  acceptanceCriteria: milestone.acceptanceCriteria,
                  paymentPercent: milestone.paymentPercent,
                  amount: breakdown.milestones[index]?.grossAmount,
                  dueAt: parseDateOnly(milestone.dueAt),
                  sortOrder: index,
                })),
              },
            },
          });
        savedProjectId = project.id;
      }

      await transaction.notification.createMany({
        data: [...new Set(getProjectTeamUserIds(application.team))].map((userId) => ({
          userId,
          title: existing ? "Doanh nghiệp đã cập nhật thỏa thuận" : "Doanh nghiệp đề nghị thỏa thuận dự án",
          message: `Vui lòng xem và phản hồi thỏa thuận dự án “${input.title}”.`,
          href: `/student/projects/${savedProjectId}`,
        })),
      });
      return { id: savedProjectId };
    });

    revalidateProject(savedProject.id, problemId);
    return {
      error: null,
      success: "Đã gửi thỏa thuận. Các xác nhận trước đây đã được làm mới.",
      projectId: savedProject.id,
    };
  } catch (error) {
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

  try {
    const { session, project } = await requireProject(projectId);
    if (project.status !== "AGREEING") {
      throw new Error("Thỏa thuận hiện không chờ phản hồi.");
    }
    const recipients = projectRecipients(project);

    if (response === "REQUEST_CHANGES") {
      if (
        session.user.role !== "STUDENT" ||
        !note ||
        note.length > 4000
      ) {
        throw new Error("Nhóm cần ghi rõ đề nghị chỉnh sửa (tối đa 4.000 ký tự).");
      }
      await prisma.$transaction(async (transaction) => {
        const changed = await transaction.project.updateMany({
          where: { id: projectId, status: "AGREEING" },
          data: {
            revisionNote: note,
            businessAcceptedAt: null,
            teamAcceptedAt: null,
          },
        });
        if (changed.count !== 1) throw new Error("Thỏa thuận đã thay đổi. Vui lòng tải lại.");
        await transaction.notification.create({
          data: {
            userId: recipients.businessUserId,
            title: "Nhóm đề nghị chỉnh sửa thỏa thuận",
            message: `Nhóm gửi đề nghị chỉnh sửa cho dự án “${project.title}”.`,
            href: `/business/projects/${projectId}`,
          },
        });
      });
    } else if (response === "ACCEPT") {
      if (!["BUSINESS", "STUDENT"].includes(session.user.role)) {
        throw new Error("Tài khoản không được phép xác nhận thỏa thuận.");
      }
      await prisma.$transaction(async (transaction) => {
        const freshProject = await transaction.project.findFirst({
          where: { id: projectId, status: "AGREEING" },
          include: { milestones: { orderBy: { sortOrder: "asc" } } },
        });
        if (!freshProject) throw new Error("Thỏa thuận đã thay đổi. Vui lòng tải lại.");
        if (freshProject.revisionNote) {
          throw new Error("Doanh nghiệp cần cập nhật thỏa thuận theo đề nghị của nhóm trước khi đồng ý.");
        }
        calculateProjectFinancialBreakdown(
          freshProject.totalAmount,
          freshProject.milestones.map(({ paymentPercent }) => paymentPercent),
          businessFeeRate,
          studentFeeRate,
        );
        const currentAcceptance =
          session.user.role === "BUSINESS"
            ? freshProject.businessAcceptedAt
            : freshProject.teamAcceptedAt;
        if (!currentAcceptance) {
          const accepted = await transaction.project.updateMany({
            where: {
              id: projectId,
              status: "AGREEING",
              agreementRevision: freshProject.agreementRevision,
              revisionNote: null,
              ...(session.user.role === "BUSINESS"
                ? { businessAcceptedAt: null }
                : { teamAcceptedAt: null }),
            },
            data:
              session.user.role === "BUSINESS"
                ? { businessAcceptedAt: new Date() }
                : { teamAcceptedAt: new Date() },
          });
          if (accepted.count !== 1) {
            throw new Error("Phiên bản thỏa thuận đã thay đổi. Vui lòng tải lại.");
          }
        }

        const updated = await transaction.project.findUniqueOrThrow({
          where: { id: projectId },
        });
        if (updated.businessAcceptedAt && updated.teamAcceptedAt) {
          const agreed = await transaction.project.updateMany({
            where: {
              id: projectId,
              status: "AGREEING",
              businessAcceptedAt: { not: null },
              teamAcceptedAt: { not: null },
            },
            data: { status: "AWAITING_PAYMENT", revisionNote: null },
          });
          if (agreed.count === 1) {
            await transaction.notification.createMany({
              data: [
                {
                  userId: recipients.businessUserId,
                  title: "Hai bên đã đồng ý thỏa thuận",
                  message: `Thỏa thuận dự án “${project.title}” đã được xác nhận. Có thể nạp tiền giả lập.`,
                  href: `/business/projects/${projectId}`,
                },
                ...recipients.teamUserIds.map((userId) => ({
                  userId,
                  title: "Hai bên đã đồng ý thỏa thuận",
                  message: `Thỏa thuận dự án “${project.title}” đã được xác nhận.`,
                  href: `/student/projects/${projectId}`,
                })),
              ],
            });
          }
        } else {
          const otherPartyUserIds =
            session.user.role === "BUSINESS"
              ? recipients.teamUserIds
              : [recipients.businessUserId];
          await transaction.notification.createMany({
            data: otherPartyUserIds.map((userId) => ({
              userId,
              title: "Đối tác đã đồng ý thỏa thuận",
              message: `Một bên đã xác nhận phiên bản ${project.agreementRevision} của dự án “${project.title}”.`,
              href:
                session.user.role === "BUSINESS"
                  ? `/student/projects/${projectId}`
                  : `/business/projects/${projectId}`,
            })),
          });
        }
      });
    } else {
      throw new Error("Phản hồi thỏa thuận không hợp lệ.");
    }
    revalidateProject(projectId, project.application.problem.id);
    return { error: null, success: "Đã ghi nhận phản hồi thỏa thuận." };
  } catch (error) {
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
          href:
            session.user.role === "BUSINESS"
              ? `/student/projects/${projectId}`
              : `/business/projects/${projectId}`,
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
    if (session.user.role !== "BUSINESS") {
      throw new Error("Chỉ doanh nghiệp sở hữu dự án mới có thể nạp tiền.");
    }
    authorizedBusiness = true;
    const key = `deposit:${projectId}`;
    await prisma.$transaction(async (transaction) => {
      const existingDeposit = await transaction.projectTransaction.findUnique({
        where: { idempotencyKey: key },
      });
      if (existingDeposit) return;

      const current = await transaction.project.findUnique({
        where: { id: projectId },
        include: { milestones: { orderBy: { sortOrder: "asc" } } },
      });
      if (
        !current ||
        current.status !== "AWAITING_PAYMENT" ||
        !current.businessAcceptedAt ||
        !current.teamAcceptedAt
      ) {
        throw new Error("Dự án chưa được hai bên đồng ý hoặc đã nạp tiền.");
      }
      const breakdown = calculateProjectFinancialBreakdown(
        current.totalAmount,
        current.milestones.map(({ paymentPercent }) => paymentPercent),
        businessFeeRate,
        studentFeeRate,
      );
      const changed = await transaction.project.updateMany({
        where: {
          id: projectId,
          status: "AWAITING_PAYMENT",
          transactions: { none: { type: "DEPOSIT" } },
        },
        data: {
          status: "IN_PROGRESS",
          startedAt: new Date(),
        },
      });
      if (changed.count !== 1) throw new Error("Dự án đã được nạp tiền.");
      const firstMilestone = current.milestones[0];
      if (!firstMilestone) throw new Error("Dự án chưa có Milestone.");
      const opened = await transaction.milestone.updateMany({
        where: {
          id: firstMilestone.id,
          projectId,
          status: "PENDING",
        },
        data: { status: "IN_PROGRESS" },
      });
      if (opened.count !== 1) throw new Error("Không thể mở Milestone đầu tiên.");

      await transaction.projectTransaction.create({
        data: {
          projectId,
          idempotencyKey: key,
          type: "DEPOSIT",
          amount: breakdown.totalDeposit,
          platformFee: breakdown.totalPlatformFee,
          platformFeeBasisPoints: breakdown.platformFeeBasisPoints,
          businessFeeBasisPoints: businessFeeRate,
          studentFeeBasisPoints: studentFeeRate,
          businessFee: breakdown.totalBusinessFee,
          status: "ESCROW",
          paidAt: new Date(),
        },
      });
      const recipients = projectRecipients(project);
      await transaction.notification.createMany({
        data: [
          {
            userId: recipients.businessUserId,
            title: "Đã nạp tiền vào escrow giả lập",
            message: `Khoản nạp ${breakdown.totalDeposit.toLocaleString("vi-VN")} ₫ cho dự án “${current.title}” đã được ghi nhận giả lập.`,
            href: `/business/projects/${projectId}`,
          },
          ...recipients.teamUserIds.map((userId) => ({
            userId,
            title: "Doanh nghiệp đã nạp tiền",
            message: `Dự án “${current.title}” đã bắt đầu. Milestone đầu tiên đang mở.`,
            href: `/student/projects/${projectId}`,
          })),
        ],
      });
    });
    revalidateProject(projectId, project.application.problem.id);
    return { error: null, success: "Đã ghi nhận khoản nạp giả lập và mở Milestone đầu tiên." };
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
  if (!progressNote || progressNote.length > 4000) {
    return { error: "Cập nhật tiến độ cần có nội dung, tối đa 4.000 ký tự." };
  }

  try {
    const { session, project } = await requireProject(projectId);
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
          href: `/student/projects/${projectId}`,
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
    if (session.user.role !== "BUSINESS") {
      throw new Error("Chỉ doanh nghiệp sở hữu dự án mới có thể nghiệm thu.");
    }
    authorizedBusiness = true;
    const milestone = project.milestones.find(({ id }) => id === milestoneId);
    if (!milestone) throw new Error("Không tìm thấy Milestone.");
    const releaseKey = getMilestoneReleaseIdempotencyKey(milestoneId);
    await prisma.$transaction(async (transaction) => {
      const existingRelease = await transaction.projectTransaction.findUnique({
        where: { idempotencyKey: releaseKey },
      });
      if (!shouldRecordMilestoneRelease(existingRelease)) return;

      const current = await transaction.project.findUnique({
        where: { id: projectId },
        include: {
          milestones: { orderBy: { sortOrder: "asc" } },
          transactions: { where: { type: "DEPOSIT", status: "ESCROW" } },
        },
      });
      if (!current || current.status !== "IN_PROGRESS") {
        throw new Error("Dự án hiện không thể nghiệm thu Milestone.");
      }
      const currentMilestone = current.milestones.find(({ id }) => id === milestoneId);
      if (!currentMilestone || currentMilestone.status !== "SUBMITTED") {
        throw new Error("Milestone chưa được nộp hoặc đã được xử lý.");
      }
      if (
        current.milestones
          .filter(({ sortOrder }) => sortOrder < currentMilestone.sortOrder)
          .some(({ status }) => status !== "ACCEPTED")
      ) {
        throw new Error("Cần nghiệm thu Milestone trước đó theo đúng thứ tự.");
      }
      const deposit = current.transactions[0];
      if (!deposit) throw new Error("Không tìm thấy khoản nạp escrow.");
      const usesLegacyFees =
        deposit.businessFeeBasisPoints === null ||
        deposit.studentFeeBasisPoints === null;
      const breakdown =
        deposit.businessFeeBasisPoints === null ||
        deposit.studentFeeBasisPoints === null
          ? calculateLegacyProjectFinancialBreakdown(
            current.totalAmount,
            current.milestones.map(({ paymentPercent }) => paymentPercent),
            legacyPlatformFeeRate,
            )
          : calculateProjectFinancialBreakdown(
            current.totalAmount,
            current.milestones.map(({ paymentPercent }) => paymentPercent),
            deposit.businessFeeBasisPoints,
            deposit.studentFeeBasisPoints,
            );
      const allocation = breakdown.milestones[currentMilestone.sortOrder];
      if (!allocation) throw new Error("Không tính được phần tiền của Milestone.");

      const accepted = await transaction.milestone.updateMany({
        where: { id: milestoneId, projectId, status: "SUBMITTED" },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      });
      if (accepted.count !== 1) throw new Error("Milestone đã được nghiệm thu trước đó.");

      await transaction.projectTransaction.create({
        data: {
          projectId,
          milestoneId,
          idempotencyKey: releaseKey,
          type: "MILESTONE_RELEASE",
          amount: allocation.teamAmount,
          platformFee: usesLegacyFees ? allocation.platformFee : allocation.studentFee,
          platformFeeBasisPoints: usesLegacyFees
            ? breakdown.platformFeeBasisPoints
            : deposit.studentFeeBasisPoints ?? studentFeeRate,
          businessFeeBasisPoints: usesLegacyFees
            ? null
            : deposit.businessFeeBasisPoints,
          studentFeeBasisPoints: usesLegacyFees
            ? null
            : deposit.studentFeeBasisPoints,
          businessFee: usesLegacyFees ? null : allocation.businessFee,
          status: "RELEASED",
          paidAt: new Date(),
        },
      });

      const allAccepted = current.milestones.every(
        ({ id, status }) => id === milestoneId || status === "ACCEPTED",
      );
      const recipients = projectRecipients(project);
      if (allAccepted) {
        const escrowClosed = await transaction.projectTransaction.updateMany({
          where: {
            id: deposit.id,
            type: "DEPOSIT",
            status: "ESCROW",
          },
          data: { status: "RELEASED" },
        });
        const completed = await transaction.project.updateMany({
          where: { id: projectId, status: "IN_PROGRESS" },
          data: { status: "COMPLETED", completedAt: new Date() },
        });
        const problemCompleted = await transaction.problem.updateMany({
          where: {
            id: project.application.problem.id,
            status: "READY_FOR_IMPLEMENTATION",
          },
          data: { status: "COMPLETED" },
        });
        if (escrowClosed.count !== 1 || completed.count !== 1 || problemCompleted.count !== 1) {
          throw new Error("Không thể hoàn tất đồng bộ dự án và bài toán.");
        }
        await transaction.notification.createMany({
          data: [
            {
              userId: recipients.businessUserId,
              title: "Dự án hoàn tất — hãy đánh giá đối tác",
              message: `Tất cả Milestone của dự án “${project.title}” đã được nghiệm thu. Hãy gửi đánh giá hợp tác trên UniBridge.`,
              href: `/business/projects/${projectId}`,
            },
            ...recipients.teamUserIds.map((userId) => ({
              userId,
              title: "Dự án hoàn tất — hãy đánh giá đối tác",
              message: `Tất cả Milestone của dự án “${project.title}” đã được nghiệm thu. Hãy gửi đánh giá hợp tác trên UniBridge.`,
              href: `/student/projects/${projectId}`,
            })),
          ],
        });
      } else {
        const nextMilestone = current.milestones.find(
          ({ sortOrder }) => sortOrder > currentMilestone.sortOrder,
        );
        if (!nextMilestone) throw new Error("Thứ tự Milestone không hợp lệ.");
        const opened = await transaction.milestone.updateMany({
          where: { id: nextMilestone.id, status: "PENDING" },
          data: { status: "IN_PROGRESS" },
        });
        if (opened.count !== 1) throw new Error("Không thể mở Milestone kế tiếp.");
        await transaction.notification.createMany({
          data: [
            {
              userId: recipients.businessUserId,
              title: "Đã nghiệm thu Milestone",
              message: `Milestone “${currentMilestone.title}” đã được nghiệm thu; đã ghi nhận phần giải ngân giả lập.`,
              href: `/business/projects/${projectId}`,
            },
            ...recipients.teamUserIds.map((userId) => ({
              userId,
              title: "Milestone được nghiệm thu",
              message: `Milestone “${currentMilestone.title}” đã được nghiệm thu; Milestone tiếp theo đã mở.`,
              href: `/student/projects/${projectId}`,
            })),
          ],
        });
      }
    });
    revalidateProject(projectId, project.application.problem.id);
    return { error: null, success: "Đã nghiệm thu Milestone và ghi nhận giải ngân giả lập." };
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
