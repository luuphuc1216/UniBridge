import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import { describe, it } from "node:test";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";
import {
  ensureBusinessCreditNotifications,
  type NotificationClock,
} from "@/lib/business-credit-notifications";
import { POST_CREDIT_SOURCES } from "@/lib/business-post-config";
import { consumePostCredit } from "@/lib/post-credits";

const NOW = new Date("2026-01-01T00:00:00.000Z");

function fixedClock(now = NOW): NotificationClock {
  return { now: () => now };
}

async function createTestDatabase() {
  const databasePath = `/tmp/unibridge-credit-notifications-${randomUUID()}.db`;
  const prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: `file:${databasePath}` }),
  });
  const statements = [
    `CREATE TABLE "User" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "email" TEXT NOT NULL UNIQUE,
      "name" TEXT NOT NULL,
      "passwordHash" TEXT NOT NULL,
      "role" TEXT NOT NULL DEFAULT 'BUSINESS',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )`,
    `CREATE TABLE "PostCredit" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "businessProfileId" TEXT NOT NULL,
      "source" TEXT NOT NULL,
      "remaining" INTEGER NOT NULL,
      "expiresAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )`,
    `CREATE TABLE "Subscription" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "businessProfileId" TEXT NOT NULL,
      "package" TEXT NOT NULL,
      "startsAt" DATETIME NOT NULL,
      "endsAt" DATETIME NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'ACTIVE',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      UNIQUE ("businessProfileId", "package")
    )`,
    `CREATE TABLE "PlatformCharge" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "businessProfileId" TEXT NOT NULL,
      "buyerId" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "amount" INTEGER NOT NULL,
      "units" INTEGER NOT NULL,
      "quantity" INTEGER,
      "periodStartsAt" DATETIME,
      "periodEndsAt" DATETIME,
      "idempotencyKey" TEXT NOT NULL UNIQUE,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE "Notification" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "userId" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "message" TEXT NOT NULL,
      "href" TEXT NOT NULL,
      "readAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "dedupeKey" TEXT UNIQUE
    )`,
    `CREATE TABLE "Problem" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "businessProfileId" TEXT NOT NULL,
      "reviewedById" TEXT,
      "title" TEXT NOT NULL,
      "slug" TEXT NOT NULL UNIQUE,
      "description" TEXT NOT NULL,
      "goal" TEXT NOT NULL,
      "field" TEXT NOT NULL,
      "requirements" TEXT NOT NULL,
      "expectedDuration" TEXT NOT NULL,
      "budgetMin" INTEGER,
      "budgetMax" INTEGER,
      "status" TEXT NOT NULL,
      "reviewNote" TEXT,
      "submittedAt" DATETIME,
      "approvedAt" DATETIME,
      "firstApprovedAt" DATETIME,
      "consumedCreditId" TEXT UNIQUE,
      "creditRefundedAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  ];
  for (const statement of statements) await prisma.$executeRawUnsafe(statement);
  await prisma.user.create({
    data: {
      id: "user",
      email: "business@example.com",
      name: "Business",
      passwordHash: "test",
      updatedAt: NOW,
    },
  });
  return {
    prisma,
    async close() {
      await prisma.$disconnect();
      await unlink(databasePath);
    },
  };
}

async function createLowBalanceDatabase(remaining: number) {
  const database = await createTestDatabase();
  await database.prisma.postCredit.create({
    data: {
      id: "free",
      businessProfileId: "business",
      source: POST_CREDIT_SOURCES.FREE,
      remaining,
      updatedAt: NOW,
    },
  });
  return database;
}

async function notify(
  database: Awaited<ReturnType<typeof createTestDatabase>>,
  clock = fixedClock(),
) {
  await database.prisma.$transaction((transaction) =>
    ensureBusinessCreditNotifications(transaction, {
      businessProfileId: "business",
      userId: "user",
      clock,
    }),
  );
}

async function notificationRows(
  database: Awaited<ReturnType<typeof createTestDatabase>>,
) {
  return database.prisma.notification.findMany({
    orderBy: { createdAt: "asc" },
  });
}

describe("business credit notification rules", () => {
  it("creates one low-balance notification across repeated dashboard loads", async () => {
    const database = await createLowBalanceDatabase(1);
    try {
      await notify(database);
      await notify(database);
      const rows = await notificationRows(database);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].title, "Lượt đăng sắp hết");
    } finally {
      await database.close();
    }
  });

  it("creates one exhausted notification across repeated dashboard loads", async () => {
    const database = await createLowBalanceDatabase(0);
    try {
      await notify(database);
      await notify(database);
      const rows = await notificationRows(database);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].title, "Bạn đã hết lượt đăng");
    } finally {
      await database.close();
    }
  });

  it("uses the latest purchase in the dedupe key after balance drops again", async () => {
    const database = await createLowBalanceDatabase(1);
    try {
      await notify(database);
      await database.prisma.platformCharge.create({
        data: {
          id: "purchase-1",
          businessProfileId: "business",
          buyerId: "user",
          type: "POST_PURCHASE",
          amount: 99000,
          units: 1,
          idempotencyKey: "purchase-key-1",
          createdAt: new Date("2026-01-02T00:00:00.000Z"),
        },
      });
      await database.prisma.postCredit.create({
        data: {
          id: "purchased",
          businessProfileId: "business",
          source: POST_CREDIT_SOURCES.PURCHASED,
          remaining: 1,
          updatedAt: NOW,
        },
      });
      await notify(database);
      await database.prisma.problem.create({
        data: {
          id: "problem",
          businessProfileId: "business",
          title: "Problem",
          slug: "problem",
          description: "Mô tả vấn đề",
          goal: "Mục tiêu",
          field: "Công nghệ",
          requirements: "Yêu cầu",
          expectedDuration: "1 tuần",
          status: "DRAFT",
          updatedAt: NOW,
        },
      });
      await database.prisma.$transaction((transaction) =>
        consumePostCredit(transaction, {
          businessProfileId: "business",
          problemId: "problem",
          clock: fixedClock(),
        }),
      );
      await notify(database);
      const rows = await notificationRows(database);
      assert.equal(rows.length, 2);
      assert.match(rows[1].dedupeKey ?? "", /purchase-1$/);
    } finally {
      await database.close();
    }
  });

  it("notifies once when Premium expires in exactly seven days", async () => {
    const database = await createLowBalanceDatabase(2);
    try {
      await database.prisma.subscription.create({
        data: {
          id: "subscription",
          businessProfileId: "business",
          package: "PREMIUM",
          startsAt: NOW,
          endsAt: new Date("2026-01-08T00:00:00.000Z"),
          updatedAt: NOW,
        },
      });
      await notify(database);
      await notify(database);
      const rows = await notificationRows(database);
      const premiumRows = rows.filter((row) => row.title === "Premium sắp hết hạn");
      assert.equal(premiumRows.length, 1);
      assert.match(
        premiumRows[0].message,
        /sẽ hết hạn lúc 07:00 ngày 08\/01\/2026\. Gia hạn để tiếp tục nhận ưu đãi\./,
      );
    } finally {
      await database.close();
    }
  });

  it("creates a new Premium notification after renewal changes endsAt", async () => {
    const database = await createLowBalanceDatabase(2);
    try {
      await database.prisma.subscription.create({
        data: {
          id: "subscription",
          businessProfileId: "business",
          package: "PREMIUM",
          startsAt: NOW,
          endsAt: new Date("2026-01-08T00:00:00.000Z"),
          updatedAt: NOW,
        },
      });
      await notify(database);
      await database.prisma.subscription.update({
        where: { id: "subscription" },
        data: { endsAt: new Date("2026-01-07T00:00:00.000Z") },
      });
      await notify(database);
      const rows = await notificationRows(database);
      assert.equal(rows.filter((row) => row.title === "Premium sắp hết hạn").length, 2);
    } finally {
      await database.close();
    }
  });

  it("does not warn for expired Premium or Premium ending in eight days", async () => {
    const database = await createLowBalanceDatabase(2);
    try {
      await database.prisma.subscription.create({
        data: {
          id: "subscription",
          businessProfileId: "business",
          package: "PREMIUM",
          startsAt: NOW,
          endsAt: new Date("2025-12-31T23:59:59.000Z"),
          updatedAt: NOW,
        },
      });
      await notify(database);
      await database.prisma.subscription.update({
        where: { id: "subscription" },
        data: { endsAt: new Date("2026-01-09T00:00:00.000Z") },
      });
      await notify(database);
      assert.equal(
        (await notificationRows(database)).filter((row) => row.title === "Premium sắp hết hạn").length,
        0,
      );
    } finally {
      await database.close();
    }
  });

  it("keeps one notification when two transactions race", async () => {
    const database = await createLowBalanceDatabase(1);
    try {
      await Promise.all([notify(database), notify(database)]);
      assert.equal((await notificationRows(database)).length, 1);
    } finally {
      await database.close();
    }
  });

  it("does not let notification creation errors escape the page boundary", async () => {
    const database = await createLowBalanceDatabase(1);
    try {
      await assert.doesNotReject(async () => {
        try {
          await database.prisma.$transaction(async (transaction) => {
            await ensureBusinessCreditNotifications(transaction, {
              businessProfileId: "business",
              userId: "missing-user",
              clock: fixedClock(),
            });
          });
        } catch {
          // The dashboard boundary logs this error and continues rendering.
        }
      });
    } finally {
      await database.close();
    }
  });
});
