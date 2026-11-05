import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  NotificationBell,
  type BusinessNotification,
} from "@/components/business/notification-bell";
import { ensureGroupSubmissionReminders } from "@/lib/prototype-reminders";
import { RoleNavigation } from "./role-navigation";

export async function StudentNavigation() {
  const session = await auth();
  let notifications: BusinessNotification[] = [];
  if (session?.user?.role === "STUDENT") {
    try {
      const team = await prisma.studentTeam.findUnique({
        where: { ownerId: session.user.id },
        select: {
          applications: {
            where: {
              status: "SELECTED",
              problem: {
                is: { status: "PROTOTYPING", prototypeLegacy: false },
              },
            },
            select: { problemId: true },
          },
        },
      });
      for (const { problemId } of team?.applications ?? []) {
        await ensureGroupSubmissionReminders(problemId);
      }
    } catch (error) {
      console.error("Không thể tạo nhắc nhở đề xuất giải pháp trên chuông sinh viên:", error);
    }
    notifications = await prisma.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        title: true,
        message: true,
        href: true,
        readAt: true,
        createdAt: true,
      },
    });
  }
  return (
    <RoleNavigation
      links={[
        { href: "/student", label: "Tổng quan" },
        { href: "/student/problems", label: "Khám phá bài toán" },
        { href: "/student/saved-problems", label: "Bài toán đã lưu" },
        { href: "/student/team", label: "Hồ sơ nhóm" },
        { href: "/student/applications", label: "Hồ sơ đã gửi" },
        { href: "/student/projects", label: "Dự án" },
        { href: "/student/transactions", label: "Giao dịch" },
      ]}
      tools={
        session?.user?.role === "STUDENT" ? (
          <NotificationBell notifications={notifications} />
        ) : undefined
      }
      title="Sinh viên"
    />
  );
}
