"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function savePortfolioItem(formData: FormData) {
  const session = await auth();
  const teamId = String(formData.get("teamId") ?? "");
  if (!session?.user || session.user.role !== "STUDENT") throw new Error("Bạn cần đăng nhập.");
  const team = await prisma.studentTeam.findFirst({ where: { id: teamId, ownerId: session.user.id }, select: { id: true } });
  if (!team) throw new Error("Bạn không có quyền quản lý nhóm này.");
  await prisma.portfolioItem.create({
    data: {
      teamId,
      title: String(formData.get("title") ?? "").trim(),
      description: String(formData.get("description") ?? "").trim(),
      demoUrl: String(formData.get("demoUrl") ?? "").trim() || null,
      field: String(formData.get("field") ?? "").trim(),
    },
  });
  revalidatePath("/student/team");
}

export async function togglePortfolioItem(formData: FormData) {
  const session = await auth();
  const id = String(formData.get("id") ?? "");
  if (!session?.user || session.user.role !== "STUDENT") throw new Error("Bạn cần đăng nhập.");
  const item = await prisma.portfolioItem.findFirst({ where: { id, team: { ownerId: session.user.id } }, select: { id: true, isVisible: true } });
  if (!item) throw new Error("Không tìm thấy mục portfolio.");
  await prisma.portfolioItem.update({ where: { id }, data: { isVisible: !item.isVisible } });
  revalidatePath("/student/team");
}
