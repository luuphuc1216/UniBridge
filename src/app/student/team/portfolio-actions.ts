"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { validateAttachment } from "@/lib/business-attachments/validation";
import { attachmentStorage } from "@/lib/storage";
import { randomUUID } from "node:crypto";
import {
  completeUploadTokens,
  parseUploadTokens,
  type CompletedUpload,
} from "@/lib/storage/upload-grants";

async function requirePortfolioManager(teamId: string, userId: string) {
  const team = await prisma.studentTeam.findFirst({
    where: {
      id: teamId,
      OR: [
        { ownerId: userId },
        { memberships: { some: { isLead: true, studentProfile: { userId } } } },
      ],
    },
    select: { id: true },
  });
  if (!team) throw new Error("Bạn không có quyền quản lý nhóm này.");
  return team;
}

async function getOptionalPortfolioFile(
  formData: FormData,
  userId: string,
  teamId: string,
  itemId?: string,
): Promise<CompletedUpload | { storageKey: string; originalName: string } | null> {
  const tokens = parseUploadTokens(formData, "file");
  if (tokens.length > 1) throw new Error("Portfolio chỉ nhận một tệp.");
  const uploaded = (
    await completeUploadTokens(tokens, userId, "STUDENT", {
      kind: "portfolio",
      teamId,
      ...(itemId ? { itemId } : {}),
    })
  )[0];
  if (uploaded) {
    if (!["image/png", "image/jpeg", "application/pdf"].includes(uploaded.contentType)) {
      await attachmentStorage.delete(uploaded.storageKey);
      throw new Error("Portfolio chỉ nhận tệp PNG, JPG hoặc PDF.");
    }
    return uploaded;
  }
  const value = formData.get("file");
  if (!(value instanceof File) || value.size === 0) return null;
  const validated = await validateAttachment(value);
  if (!["image/png", "image/jpeg", "application/pdf"].includes(validated.contentType)) {
    throw new Error("Portfolio chỉ nhận tệp PNG, JPG hoặc PDF.");
  }
  const storageKey = randomUUID();
  await attachmentStorage.save(storageKey, validated.content);
  return { storageKey, originalName: validated.originalName };
}

export async function savePortfolioItem(formData: FormData) {
  const session = await auth();
  const teamId = String(formData.get("teamId") ?? "");
  if (!session?.user || session.user.role !== "STUDENT") throw new Error("Bạn cần đăng nhập.");
  await requirePortfolioManager(teamId, session.user.id);
  const file = await getOptionalPortfolioFile(formData, session.user.id, teamId);
  try {
    await prisma.portfolioItem.create({
      data: {
        teamId,
        title: String(formData.get("title") ?? "").trim(),
        description: String(formData.get("description") ?? "").trim(),
        demoUrl: String(formData.get("demoUrl") ?? "").trim() || null,
        field: String(formData.get("field") ?? "").trim(),
        fileStorageKey: file?.storageKey,
        fileName: file?.originalName,
      },
    });
  } catch (error) {
    if (file) await attachmentStorage.delete(file.storageKey);
    throw error;
  }
  revalidatePath("/student/team");
}

export async function updatePortfolioItem(formData: FormData) {
  const session = await auth();
  const id = String(formData.get("id") ?? "");
  if (!session?.user || session.user.role !== "STUDENT") throw new Error("Bạn cần đăng nhập.");
  const item = await prisma.portfolioItem.findFirst({
    where: { id },
    select: { id: true, teamId: true, fileStorageKey: true },
  });
  if (!item) throw new Error("Không tìm thấy mục portfolio.");
  await requirePortfolioManager(item.teamId, session.user.id);
  const file = await getOptionalPortfolioFile(formData, session.user.id, item.teamId, id);
  try {
    await prisma.portfolioItem.update({
      where: { id },
      data: {
        title: String(formData.get("title") ?? "").trim(),
        description: String(formData.get("description") ?? "").trim(),
        demoUrl: String(formData.get("demoUrl") ?? "").trim() || null,
        field: String(formData.get("field") ?? "").trim(),
        ...(file ? { fileStorageKey: file.storageKey, fileName: file.originalName } : {}),
      },
    });
  } catch (error) {
    if (file) await attachmentStorage.delete(file.storageKey);
    throw error;
  }
  if (file && item.fileStorageKey) await attachmentStorage.delete(item.fileStorageKey);
  revalidatePath("/student/team");
}

export async function togglePortfolioItem(formData: FormData) {
  const session = await auth();
  const id = String(formData.get("id") ?? "");
  if (!session?.user || session.user.role !== "STUDENT") throw new Error("Bạn cần đăng nhập.");
  const item = await prisma.portfolioItem.findFirst({ where: { id }, select: { id: true, teamId: true, isVisible: true } });
  if (!item) throw new Error("Không tìm thấy mục portfolio.");
  await requirePortfolioManager(item.teamId, session.user.id);
  await prisma.portfolioItem.update({ where: { id }, data: { isVisible: !item.isVisible } });
  revalidatePath("/student/team");
}

export async function deletePortfolioItem(formData: FormData) {
  const session = await auth();
  const id = String(formData.get("id") ?? "");
  if (!session?.user || session.user.role !== "STUDENT") throw new Error("Bạn cần đăng nhập.");
  const item = await prisma.portfolioItem.findFirst({ where: { id }, select: { id: true, teamId: true, fileStorageKey: true } });
  if (!item) throw new Error("Không tìm thấy mục portfolio.");
  await requirePortfolioManager(item.teamId, session.user.id);
  await prisma.portfolioItem.delete({ where: { id } });
  if (item.fileStorageKey) await attachmentStorage.delete(item.fileStorageKey);
  revalidatePath("/student/team");
}

export async function addCompletedProjectToPortfolio(formData: FormData) {
  const session = await auth();
  const projectId = String(formData.get("projectId") ?? "");
  if (!session?.user || session.user.role !== "STUDENT") throw new Error("Bạn cần đăng nhập.");
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      status: "COMPLETED",
      team: {
        OR: [
          { ownerId: session.user.id },
          { memberships: { some: { studentProfile: { userId: session.user.id } } } },
        ],
      },
    },
    select: { id: true, teamId: true, title: true, application: { select: { problem: { select: { field: true } } } } },
  });
  if (!project) throw new Error("Dự án không tồn tại hoặc nhóm không tham gia dự án.");
  await requirePortfolioManager(project.teamId, session.user.id);
  await prisma.portfolioItem.create({
    data: {
      teamId: project.teamId,
      sourceProjectId: project.id,
      title: project.title,
      description: "Đã hoàn thành trên UniBridge",
      field: project.application.problem.field,
    },
  });
  revalidatePath("/student/team");
}
