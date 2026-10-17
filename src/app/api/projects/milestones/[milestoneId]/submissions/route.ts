import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import {
  MAX_PROPOSAL_FILE_COUNT,
  MAX_PROPOSAL_FILE_TOTAL_BYTES,
} from "@/lib/business-attachments/config";
import { validateAttachment } from "@/lib/business-attachments/validation";
import { findAccessibleProject, getProjectTeamUserIds } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { attachmentStorage } from "@/lib/storage";
import {
  parseMilestoneSubmissionLinks,
  validateMilestoneSubmission,
} from "@/lib/milestone-submission-validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ milestoneId: string }> },
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "STUDENT") {
    return Response.json({ error: "Vui lòng đăng nhập bằng tài khoản sinh viên." }, { status: 401 });
  }

  const { milestoneId } = await params;
  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    select: { projectId: true },
  });
  if (!milestone) return Response.json({ error: "Không tìm thấy Milestone." }, { status: 404 });

  const project = await findAccessibleProject(
    milestone.projectId,
    session.user.id,
    session.user.role,
  );
  if (!project || project.status !== "IN_PROGRESS") {
    return Response.json({ error: "Bạn không có quyền nộp kết quả cho Milestone này." }, { status: 404 });
  }

  const activeMilestone = project.milestones.find(({ id }) => id === milestoneId);
  if (
    !activeMilestone ||
    !["IN_PROGRESS", "REVISION_REQUESTED"].includes(activeMilestone.status) ||
    project.milestones
      .filter(({ sortOrder }) => sortOrder < activeMilestone.sortOrder)
      .some(({ status }) => status !== "ACCEPTED")
  ) {
    return Response.json({ error: "Milestone này chưa mở để nộp kết quả." }, { status: 409 });
  }

  const storedKeys: string[] = [];
  try {
    const formData = await request.formData();
    const note = String(formData.get("note") ?? "").trim();
    if (note.length > 10_000) {
      return Response.json({ error: "Mô tả kết quả tối đa 10.000 ký tự." }, { status: 400 });
    }
    const files = formData
      .getAll("files")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);
    const links = parseMilestoneSubmissionLinks(String(formData.get("links") ?? ""));
    const validationError = validateMilestoneSubmission(note, files.length, links);
    if (validationError) {
      return Response.json({ error: validationError }, { status: 400 });
    }
    if (files.length > MAX_PROPOSAL_FILE_COUNT) {
      return Response.json({ error: `Mỗi lần nộp được đính kèm tối đa ${MAX_PROPOSAL_FILE_COUNT} tệp.` }, { status: 400 });
    }
    const validatedFiles = await Promise.all(files.map(validateAttachment));
    if (
      validatedFiles.reduce((total, file) => total + file.sizeBytes, 0) >
      MAX_PROPOSAL_FILE_TOTAL_BYTES
    ) {
      return Response.json({ error: "Tổng dung lượng tệp vượt quá giới hạn cho phép." }, { status: 400 });
    }
    for (const file of validatedFiles) {
      const storageKey = randomUUID();
      storedKeys.push(storageKey);
      await attachmentStorage.save(storageKey, file.content);
    }

    await prisma.$transaction(async (transaction) => {
      const current = await transaction.milestone.findFirst({
        where: {
          id: milestoneId,
          projectId: project.id,
          status: { in: ["IN_PROGRESS", "REVISION_REQUESTED"] },
          project: { status: "IN_PROGRESS" },
        },
        include: {
          project: {
            include: {
              milestones: { orderBy: { sortOrder: "asc" } },
              application: {
                include: {
                  problem: { select: { title: true, businessProfile: { select: { userId: true } } } },
                },
              },
              team: {
                select: {
                  ownerId: true,
                  memberships: { select: { studentProfile: { select: { userId: true } } } },
                },
              },
            },
          },
        },
      });
      if (!current) throw new Error("Milestone đã thay đổi. Vui lòng tải lại trang.");
      if (
        current.project.milestones
          .filter(({ sortOrder }) => sortOrder < current.sortOrder)
          .some(({ status }) => status !== "ACCEPTED")
      ) {
        throw new Error("Milestone trước cần được nghiệm thu trước khi nộp.");
      }
      const submission = await transaction.milestoneSubmission.create({
        data: {
          milestoneId,
          submittedById: session.user.id,
          note,
          links: JSON.stringify(links),
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
      const changed = await transaction.milestone.updateMany({
        where: {
          id: milestoneId,
          projectId: project.id,
          status: { in: ["IN_PROGRESS", "REVISION_REQUESTED"] },
        },
        data: {
          status: "SUBMITTED",
          submittedAt: new Date(),
          revisionFeedback: null,
        },
      });
      if (changed.count !== 1) throw new Error("Milestone đã được nộp. Vui lòng tải lại.");
      const businessUserId = current.project.application.problem.businessProfile.userId;
      const teamUserIds = getProjectTeamUserIds(current.project.team);
      await transaction.notification.createMany({
        data: [
          {
            userId: businessUserId,
            title: "Nhóm đã nộp kết quả Milestone",
            message: `Nhóm đã nộp kết quả cho “${current.title}” của dự án “${current.project.title}”.`,
            href: `/business/projects/${project.id}`,
          },
          ...teamUserIds
            .filter((userId) => userId !== session.user.id)
            .map((userId) => ({
              userId,
              title: "Nhóm đã nộp kết quả Milestone",
              message: `Đã lưu lần nộp kết quả mới cho “${current.title}”.`,
              href: `/student/projects/${project.id}`,
            })),
        ],
      });
      return submission.id;
    });

    return Response.json({ success: "Đã nộp kết quả Milestone." });
  } catch (error) {
    await Promise.all(
      storedKeys.map(async (storageKey) => {
        try {
          await attachmentStorage.delete(storageKey);
        } catch (cleanupError) {
          console.error("Không thể dọn tệp Milestone sau lỗi:", cleanupError);
        }
      }),
    );
    if (error instanceof Error) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error("Nộp kết quả Milestone thất bại:", error);
    return Response.json({ error: "Đã xảy ra lỗi. Vui lòng thử lại." }, { status: 500 });
  }
}
