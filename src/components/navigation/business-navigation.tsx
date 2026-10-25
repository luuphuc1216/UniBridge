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
  let creditTotal = 0;
  if (session?.user?.role === "BUSINESS") {
    const [profile, credits] = await Promise.all([
      prisma.businessProfile.findUnique({ where: { userId: session.user.id }, select: { id: true } }),
      prisma.notification.findMany({
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
      }),
    ]);
    notifications = credits;
    if (profile) {
      const balances = await prisma.postCredit.findMany({
        where: { businessProfileId: profile.id, remaining: { gt: 0 } },
        select: { remaining: true },
      });
      creditTotal = balances.reduce((sum, credit) => sum + credit.remaining, 0);
    }
  }

  return (
    <RoleNavigation
      links={[
        { href: "/business", label: "Tổng quan" },
        { href: "/business/problems", label: "Bài toán của tôi" },
        { href: "/business/credits", label: `Gói và hạn mức (${creditTotal})` },
        { href: "/business/projects", label: "Dự án" },
        { href: "/business/transactions", label: "Giao dịch" },
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
