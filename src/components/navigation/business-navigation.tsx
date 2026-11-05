import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  NotificationBell,
  type BusinessNotification,
} from "@/components/business/notification-bell";
import {
  ensureBusinessPrototypeReminders,
  ensureGroupSubmissionReminders,
} from "@/lib/prototype-reminders";
import { ensureBusinessCreditNotifications } from "@/lib/business-credit-notifications";
import { RoleNavigation } from "./role-navigation";

export async function BusinessNavigation() {
  const session = await auth();
  let notifications: BusinessNotification[] = [];
  let creditTotal = 0;
  if (session?.user?.role === "BUSINESS") {
    const profile = await prisma.businessProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (profile) {
      try {
        await prisma.$transaction((transaction) =>
          ensureBusinessCreditNotifications(transaction, {
            businessProfileId: profile.id,
            userId: session.user.id,
          }),
        );
        const problems = await prisma.problem.findMany({
          where: {
            businessProfileId: profile.id,
            prototypeLegacy: false,
            status: { in: ["PROTOTYPING", "EVALUATING"] },
          },
          select: { id: true },
        });
        for (const problem of problems) {
          await ensureGroupSubmissionReminders(problem.id);
          await ensureBusinessPrototypeReminders(problem.id, session.user.id);
        }
      } catch (error) {
        console.error("Không thể tạo nhắc nhở Bản thử nghiệm (Prototype) trên chuông doanh nghiệp:", error);
      }
    }
    const [credits, notificationRows] = await Promise.all([
      profile
        ? prisma.postCredit.findMany({
            where: { businessProfileId: profile.id, remaining: { gt: 0 } },
            select: { remaining: true },
          })
        : Promise.resolve([]),
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
    notifications = notificationRows;
    creditTotal = credits.reduce((sum, credit) => sum + credit.remaining, 0);
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
