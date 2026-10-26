import type { Prisma } from "@/generated/prisma/client";
import { Prisma as PrismaNamespace } from "@/generated/prisma/client";
import { POST_CREDIT_SOURCES } from "./business-post-config";
import { formatVietnamDateTime } from "./date-format";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
type Transaction = Prisma.TransactionClient;
export type NotificationClock = { now(): Date };
export const systemNotificationClock: NotificationClock = { now: () => new Date() };

function isUniqueViolation(error: unknown): boolean {
  return error instanceof PrismaNamespace.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function ensureBusinessCreditNotifications(
  transaction: Transaction,
  {
    businessProfileId,
    userId,
    clock = systemNotificationClock,
  }: { businessProfileId: string; userId: string; clock?: NotificationClock },
): Promise<void> {
  const now = clock.now();
  const [credits, subscription, latestCharge] = await Promise.all([
    transaction.postCredit.findMany({
      where: { businessProfileId, remaining: { gt: 0 } },
      select: { source: true, remaining: true, expiresAt: true },
    }),
    transaction.subscription.findUnique({
      where: { businessProfileId_package: { businessProfileId, package: "PREMIUM" } },
      select: { id: true, endsAt: true, status: true },
    }),
    transaction.platformCharge.findFirst({
      where: { businessProfileId, type: { in: ["POST_PURCHASE", "PREMIUM"] } },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    }),
  ]);
  const purchaseId = latestCharge?.id ?? "none";
  const remaining = credits.reduce((total, credit) => {
    if (
      credit.source === POST_CREDIT_SOURCES.PREMIUM &&
      (!credit.expiresAt || credit.expiresAt <= now)
    ) {
      return total;
    }
    return total + credit.remaining;
  }, 0);
  if (remaining <= 1) {
    const dedupeKey = `post-credit-${businessProfileId}-${remaining}-${purchaseId}`;
    try {
      await transaction.notification.create({
        data: {
          userId,
          dedupeKey,
          title: remaining === 0 ? "Bạn đã hết lượt đăng" : "Lượt đăng sắp hết",
          message:
            remaining === 0
              ? "Bạn đã hết lượt đăng bài. Mua thêm lượt hoặc Premium để tiếp tục."
              : "Bạn chỉ còn 1 lượt đăng bài. Hãy mua thêm lượt hoặc Premium khi cần.",
          href: "/business/credits",
        },
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  if (
    subscription?.status === "ACTIVE" &&
    subscription.endsAt > now &&
    subscription.endsAt.getTime() - now.getTime() <= SEVEN_DAYS_MS
  ) {
    try {
      await transaction.notification.create({
        data: {
          userId,
          dedupeKey: `premium-expiring-${subscription.id}-${subscription.endsAt.toISOString()}`,
          title: "Premium sắp hết hạn",
          message: `Gói Premium của bạn sẽ hết hạn lúc ${formatVietnamDateTime(subscription.endsAt, true)}. Gia hạn để tiếp tục nhận ưu đãi.`,
          href: "/business/credits",
        },
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
}
