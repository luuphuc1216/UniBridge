import assert from "node:assert/strict";
import test from "node:test";
import { AI_LIMITS } from "./config";
import {
  calculateAiRemaining,
  completeAiUsage,
  getAiUsageRemaining,
  reserveAiUsage,
} from "./usage";
import { createTestDatabase } from "@/lib/test-database";

test("AI usage clamps daily and monthly remaining limits at zero", () => {
  assert.deepEqual(calculateAiRemaining(0, 0), {
    daily: AI_LIMITS.daily,
    monthly: AI_LIMITS.monthly,
  });

  test("platform moderation quota is isolated per business and excluded from Premium remaining", async () => {
    const database = await createTestDatabase("ai-platform-quota");
    try {
      const first = await database.prisma.$transaction((transaction) =>
        reserveAiUsage(transaction, {
          feature: "PROBLEM_REVIEW",
          platform: true,
          platformQuotaKey: "PLATFORM:business",
          targetId: "problem",
        }),
      );
      await completeAiUsage(database.prisma, first.usageId, "SUCCEEDED");
      const premiumRemaining = await getAiUsageRemaining(database.prisma, "business");
      assert.equal(premiumRemaining.daily, AI_LIMITS.daily);
      const platformRows = await database.prisma.aiUsage.count({
        where: { quotaKey: "PLATFORM:business" },
      });
      assert.equal(platformRows, 1);
    } finally {
      await database.close();
    }
  });

  test("parallel reservations never exceed the daily or monthly limits", async () => {
    const database = await createTestDatabase("ai-parallel");
    try {
      const results = await Promise.allSettled(
        Array.from({ length: AI_LIMITS.daily + 5 }, () =>
          database.prisma.$transaction((transaction) =>
            reserveAiUsage(transaction, {
              businessProfileId: "business",
              feature: "PROBLEM_DRAFT",
            }),
          ),
        ),
      );
      const recorded = await database.prisma.aiUsage.count({
        where: { businessProfileId: "business", status: "RESERVED" },
      });
      assert.ok(recorded <= AI_LIMITS.daily);
      assert.ok(recorded <= AI_LIMITS.monthly);
      assert.equal(
        results.filter((result) => result.status === "fulfilled").length,
        recorded,
      );
    } finally {
      await database.close();
    }
  });

  test("expired RESERVED reservations are failed and no longer consume limits", async () => {
    const database = await createTestDatabase("ai-expired");
    try {
      const now = new Date();
      const old = new Date(now.getTime() - 3 * 60 * 1000);
      await database.prisma.aiUsage.create({
        data: {
          id: "expired-usage",
          businessProfileId: "business",
          quotaKey: "business",
          feature: "PROBLEM_DRAFT",
          status: "RESERVED",
          createdAt: old,
        },
      });
      await database.prisma.aiUsageBucket.createMany({
        data: [
          {
            businessProfileId: "business",
            quotaKey: "business",
            periodType: "DAY",
            periodStart: new Date(Date.UTC(old.getUTCFullYear(), old.getUTCMonth(), old.getUTCDate())),
            used: 1,
          },
          {
            businessProfileId: "business",
            quotaKey: "business",
            periodType: "MONTH",
            periodStart: new Date(Date.UTC(old.getUTCFullYear(), old.getUTCMonth(), 1)),
            used: 1,
          },
        ],
      });
      const remainingBefore = await getAiUsageRemaining(database.prisma, "business", now);
      assert.equal(remainingBefore.daily, AI_LIMITS.daily);
      await database.prisma.$transaction((transaction) =>
        reserveAiUsage(transaction, {
          businessProfileId: "business",
          feature: "PROBLEM_DRAFT",
        }),
      );
      const expired = await database.prisma.aiUsage.findUniqueOrThrow({
        where: { id: "expired-usage" },
      });
      assert.equal(expired.status, "FAILED");
    } finally {
      await database.close();
    }
  });

  test("FAILED provider usage releases its reserved allowance", async () => {
    const database = await createTestDatabase("ai-failed");
    try {
      const { usageId } = await database.prisma.$transaction((transaction) =>
        reserveAiUsage(transaction, {
          businessProfileId: "business",
          feature: "PROBLEM_DRAFT",
        }),
      );
      await completeAiUsage(database.prisma, usageId, "FAILED");
      const remaining = await getAiUsageRemaining(database.prisma, "business");
      assert.equal(remaining.daily, AI_LIMITS.daily);
      assert.equal(remaining.monthly, AI_LIMITS.monthly);
    } finally {
      await database.close();
    }
  });
  assert.deepEqual(calculateAiRemaining(AI_LIMITS.daily, AI_LIMITS.monthly), {
    daily: 0,
    monthly: 0,
  });
  assert.deepEqual(calculateAiRemaining(AI_LIMITS.daily + 5, AI_LIMITS.monthly + 5), {
    daily: 0,
    monthly: 0,
  });
});
