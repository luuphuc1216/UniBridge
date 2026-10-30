import { auth } from "@/auth";
import {
  NotificationBell,
  type BusinessNotification,
} from "@/components/business/notification-bell";
import { prisma } from "@/lib/prisma";
import { ensureAdminHandoffReminders } from "@/lib/prototype-reminders";
import { RoleNavigation } from "./role-navigation";

export async function AdminNavigation() {
  const session = await auth();
  let notifications: BusinessNotification[] = [];
  if (session?.user?.role === "ADMIN") {
    try {
      await ensureAdminHandoffReminders();
    } catch (error) {
      console.error("Không thể tạo nhắc bàn giao trên chuông Admin:", error);
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
        { href: "/admin", label: "Tổng quan" },
        { href: "/admin/problems", label: "Duyệt bài toán" },
        { href: "/admin/prototype-handoffs", label: "Kiểm tra bàn giao Prototype" },
      ]}
      tools={
        session?.user?.role === "ADMIN" ? (
          <NotificationBell notifications={notifications} />
        ) : undefined
      }
      title="Quản trị viên"
    />
  );
}
