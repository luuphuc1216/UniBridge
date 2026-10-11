import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  NotificationBell,
  type BusinessNotification,
} from "@/components/business/notification-bell";
import { RoleNavigation } from "./role-navigation";

export async function BusinessNavigation() {
  const session = await auth();
  let notifications: BusinessNotification[] = [];
  if (session?.user?.role === "BUSINESS") {
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
        { href: "/business", label: "Tổng quan" },
        { href: "/business/problems", label: "Bài toán của tôi" },
      ]}
      tools={
        session?.user?.role === "BUSINESS" ? (
          <NotificationBell notifications={notifications} />
        ) : undefined
      }
      title="Doanh nghiệp"
    />
  );
}
