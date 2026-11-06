import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  NotificationBell,
  type BusinessNotification,
} from "@/components/business/notification-bell";
import { ensureGroupSubmissionReminders } from "@/lib/prototype-reminders";
import { RoleNavigation } from "./role-navigation";
import { getUnreadWorkspaceMessageCount } from "@/lib/workspace-messages";

export async function StudentNavigation() {
  const session = await auth();
  let notifications: BusinessNotification[] = [];
  let unreadMessages = 0;
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
      console.error("Không thể tạo nhắc nhở Proposal trên chuông sinh viên:", error);
    }
    const [notificationRows, unread] = await Promise.all([prisma.notification.findMany({
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
    }), getUnreadWorkspaceMessageCount(session.user.id, "STUDENT")]);
    notifications = notificationRows;
    unreadMessages = unread;
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
        { href: "/student/messages", label: `Tin nhắn${unreadMessages ? ` (${unreadMessages})` : ""}` },
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
