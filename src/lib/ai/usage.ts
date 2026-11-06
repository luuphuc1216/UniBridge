import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { AI_LIMITS, type AiFeature } from "@/lib/ai/config";

type ReadDatabase = PrismaClient | Prisma.TransactionClient;
const RESERVED_TIMEOUT_MS = 2 * 60 * 1000;
const PLATFORM_QUOTA_KEY = "PLATFORM";

function startOfMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function startOfDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function calculateAiRemaining(dailyUsed: number, monthlyUsed: number) {
  return {
    daily: Math.max(AI_LIMITS.daily - dailyUsed, 0),
    monthly: Math.max(AI_LIMITS.monthly - monthlyUsed, 0),
  };
}

async function decrementBucket(
  database: ReadDatabase,
  quotaKey: string,
  periodType: "DAY" | "MONTH",
  periodStart: Date,
) {
  await database.aiUsageBucket.updateMany({
    where: {
      quotaKey,
      periodType,
      periodStart,
      used: { gt: 0 },
    },
    data: { used: { decrement: 1 } },
  });
}

async function failExpiredReservations(
  database: ReadDatabase,
  quotaKey: string,
  now: Date,
) {
  const expired = await database.aiUsage.findMany({
    where: {
      quotaKey,
      status: "RESERVED",
      createdAt: { lt: new Date(now.getTime() - RESERVED_TIMEOUT_MS) },
    },
    select: { id: true, createdAt: true },
  });
  for (const usage of expired) {
    const changed = await database.aiUsage.updateMany({
      where: { id: usage.id, status: "RESERVED" },
      data: { status: "FAILED", completedAt: now },
    });
    if (changed.count === 1) {
      await decrementBucket(database, quotaKey, "DAY", startOfDay(usage.createdAt));
      await decrementBucket(database, quotaKey, "MONTH", startOfMonth(usage.createdAt));
    }
  }
}

export async function getAiUsageRemaining(
  database: ReadDatabase,
  businessProfileId: string,
  now = new Date(),
) {
  const cutoff = new Date(now.getTime() - RESERVED_TIMEOUT_MS);
  const [daily, monthly] = await Promise.all([
    database.aiUsage.count({
      where: {
        quotaKey: businessProfileId,
        status: "SUCCEEDED",
        createdAt: { gte: startOfDay(now) },
      },
    }),
    database.aiUsage.count({
      where: {
        quotaKey: businessProfileId,
        status: "SUCCEEDED",
        createdAt: { gte: startOfMonth(now) },
      },
    }),
  ]);
  const [activeDaily, activeMonthly] = await Promise.all([
    database.aiUsage.count({
      where: {
        quotaKey: businessProfileId,
        status: "RESERVED",
        createdAt: { gte: startOfDay(now) },
        AND: [{ createdAt: { gte: cutoff } }],
      },
    }),
    database.aiUsage.count({
      where: {
        quotaKey: businessProfileId,
        status: "RESERVED",
        createdAt: { gte: startOfMonth(now) },
        AND: [{ createdAt: { gte: cutoff } }],
      },
    }),
  ]);
  return calculateAiRemaining(daily + activeDaily, monthly + activeMonthly);
}

export async function reserveAiUsage(
  database: Prisma.TransactionClient,
  input: {
    businessProfileId?: string;
    feature: AiFeature;
    platform?: boolean;
    platformQuotaKey?: string;
    targetId?: string;
  },
) {
  const now = new Date();
  const quotaKey = input.platform
    ? input.platformQuotaKey ?? PLATFORM_QUOTA_KEY
    : input.businessProfileId;
  if (!quotaKey) throw new Error("Không xác định được nguồn hạn mức AI.");
  await failExpiredReservations(database, quotaKey, now);
  const day = startOfDay(now);
  const month = startOfMonth(now);

  await database.aiUsageBucket.upsert({
    where: {
      quotaKey_periodType_periodStart: {
        quotaKey,
        periodType: "DAY",
        periodStart: day,
      },
    },
    create: { quotaKey, businessProfileId: input.platform ? null : input.businessProfileId, periodType: "DAY", periodStart: day },
    update: {},
  });
  await database.aiUsageBucket.upsert({
    where: {
      quotaKey_periodType_periodStart: {
        quotaKey,
        periodType: "MONTH",
        periodStart: month,
      },
    },
    create: { quotaKey, businessProfileId: input.platform ? null : input.businessProfileId, periodType: "MONTH", periodStart: month },
    update: {},
  });

  const dailyUpdate = await database.aiUsageBucket.updateMany({
    where: {
      quotaKey,
      periodType: "DAY",
      periodStart: day,
      used: { lt: AI_LIMITS.daily },
    },
    data: { used: { increment: 1 } },
  });
  if (dailyUpdate.count !== 1) throw new Error("Bạn đã hết lượt AI trong ngày.");

  const monthlyUpdate = await database.aiUsageBucket.updateMany({
    where: {
      quotaKey,
      periodType: "MONTH",
      periodStart: month,
      used: { lt: AI_LIMITS.monthly },
    },
    data: { used: { increment: 1 } },
  });
  if (monthlyUpdate.count !== 1) {
    await decrementBucket(database, quotaKey, "DAY", day);
    throw new Error("Bạn đã hết lượt AI trong tháng.");
  }

  const usage = await database.aiUsage.create({
    data: {
      businessProfileId: input.platform ? null : input.businessProfileId,
      quotaKey,
      targetId: input.targetId,
      feature: input.feature,
    },
  });
  return {
    usageId: usage.id,
    remaining: calculateAiRemaining(
      (await database.aiUsageBucket.findUniqueOrThrow({
        where: {
          quotaKey_periodType_periodStart: {
            quotaKey,
            periodType: "DAY",
            periodStart: day,
          },
        },
      })).used,
      (await database.aiUsageBucket.findUniqueOrThrow({
        where: {
          quotaKey_periodType_periodStart: {
            quotaKey,
            periodType: "MONTH",
            periodStart: month,
          },
        },
      })).used,
    ),
  };
}

export async function completeAiUsage(
  database: PrismaClient,
  usageId: string,
  status: "SUCCEEDED" | "FAILED",
) {
  if (status === "FAILED") {
    await database.$transaction(async (transaction) => {
      const usage = await transaction.aiUsage.findUnique({
        where: { id: usageId },
        select: { quotaKey: true, createdAt: true, status: true },
      });
      if (!usage || usage.status !== "RESERVED") return;
      await transaction.aiUsage.update({
        where: { id: usageId },
        data: { status, completedAt: new Date() },
      });
      await decrementBucket(transaction, usage.quotaKey, "DAY", startOfDay(usage.createdAt));
      await decrementBucket(transaction, usage.quotaKey, "MONTH", startOfMonth(usage.createdAt));
    });
    return;
  }
  await database.aiUsage.updateMany({
    where: { id: usageId, status: "RESERVED" },
    data: { status, completedAt: new Date() },
  });
}
