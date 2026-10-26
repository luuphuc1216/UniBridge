import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import { describe, it } from "node:test";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";
import {
  BUSINESS_POST_CONFIG,
  POST_CREDIT_SOURCES,
} from "@/lib/business-post-config";
import {
  consumePostCredit,
  purchasePremium,
  purchasePostCredits,
  refundProblemCredit,
  submitProblemForReview,
  type CreditClock,
} from "@/lib/post-credits";

function fixedClock(value: string): CreditClock {
  return { now: () => new Date(value) };
}

function problemData(id: string, status: string, consumedCreditId?: string) {
  return {
    id,
    businessProfileId: "business",
    title: id,
    slug: id,
    description: "Mô tả",
    goal: "Mục tiêu",
    field: "Công nghệ",
    requirements: "Yêu cầu",
    expectedDuration: "1 tuần",
    status,
    ...(consumedCreditId ? { consumedCreditId } : {}),
  };
}

async function createTestDatabase() {
  const databasePath = `/tmp/unibridge-post-credits-${randomUUID()}.db`;
  const prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: `file:${databasePath}` }),
  });
  const statements = [
    `CREATE TABLE "PostCredit" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "businessProfileId" TEXT NOT NULL,
      "source" TEXT NOT NULL,
      "remaining" INTEGER NOT NULL,
      "expiresAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
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
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "consumedCreditId" TEXT UNIQUE,
      "creditRefundedAt" DATETIME
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
  ];
  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }
  return {
    prisma,
    async close() {
      await prisma.$disconnect();
      await unlink(databasePath);
    },
  };
}

describe("post credit transactions", () => {
  it("consumes credits in FREE, PREMIUM, PURCHASED order", async () => {
    const database = await createTestDatabase();
    const clock = fixedClock("2026-01-01T00:00:00.000Z");
    try {
      await database.prisma.postCredit.createMany({
        data: [
          {
            id: "purchased",
            businessProfileId: "business",
            source: POST_CREDIT_SOURCES.PURCHASED,
            remaining: 1,
            updatedAt: new Date(),
          },
          {
            id: "premium",
            businessProfileId: "business",
            source: POST_CREDIT_SOURCES.PREMIUM,
            remaining: 1,
            expiresAt: new Date("2026-02-01T00:00:00.000Z"),
            updatedAt: new Date(),
          },
          {
            id: "free",
            businessProfileId: "business",
            source: POST_CREDIT_SOURCES.FREE,
            remaining: 1,
            updatedAt: new Date(),
          },
        ],
      });
      for (const [index, expected] of ["FREE", "PREMIUM", "PURCHASED"].entries()) {
        const problemId = `problem-${index}`;
        await database.prisma.problem.create({
          data: problemData(problemId, "DRAFT"),
        });
        const result = await database.prisma.$transaction((transaction) =>
          consumePostCredit(transaction, {
            businessProfileId: "business",
            problemId,
            clock,
          }),
        );
        assert.equal(result.status, "consumed");
        if (result.status === "consumed") assert.equal(result.source, expected);
      }
    } finally {
      await database.close();
    }
  });

  it("allows only one concurrent submission for a problem", async () => {
    const database = await createTestDatabase();
    try {
      await database.prisma.postCredit.create({
        data: {
          id: "free",
          businessProfileId: "business",
          source: POST_CREDIT_SOURCES.FREE,
          remaining: 2,
          updatedAt: new Date(),
        },
      });

      it("keeps a new problem as a complete draft when no credit is available", async () => {
        const database = await createTestDatabase();
        try {
          await database.prisma.problem.create({
            data: problemData("problem", "DRAFT"),
          });
          const result = await database.prisma.$transaction((transaction) =>
            submitProblemForReview(transaction, {
              businessProfileId: "business",
              problemId: "problem",
            }),
          );
          assert.deepEqual(result, { status: "no_credits" });
          const problem = await database.prisma.problem.findUniqueOrThrow({
            where: { id: "problem" },
          });
          assert.equal(problem.status, "DRAFT");
          assert.equal(problem.consumedCreditId, null);
          assert.equal(problem.title, "problem");
        } finally {
          await database.close();
        }
      });

      it("resubmits NEEDS_REVISION without consuming another credit", async () => {
        const database = await createTestDatabase();
        try {
          await database.prisma.postCredit.create({
            data: {
              id: "free",
              businessProfileId: "business",
              source: POST_CREDIT_SOURCES.FREE,
              remaining: 1,
              updatedAt: new Date(),
            },
          });
          await database.prisma.problem.create({
            data: problemData("problem", "DRAFT"),
          });
          const first = await database.prisma.$transaction((transaction) =>
            submitProblemForReview(transaction, {
              businessProfileId: "business",
              problemId: "problem",
            }),
          );
          await database.prisma.problem.update({
            where: { id: "problem" },
            data: { status: "NEEDS_REVISION" },
          });
          const second = await database.prisma.$transaction((transaction) =>
            submitProblemForReview(transaction, {
              businessProfileId: "business",
              problemId: "problem",
            }),
          );
          assert.equal(first.status, "submitted");
          assert.equal(second.status, "submitted");
          assert.equal(
            (await database.prisma.postCredit.findUniqueOrThrow({ where: { id: "free" } })).remaining,
            0,
          );
        } finally {
          await database.close();
        }
      });
      await database.prisma.problem.create({
        data: problemData("problem", "DRAFT"),
      });
      const results = await Promise.all(
        [1, 2].map(() =>
          database.prisma.$transaction((transaction) =>
            consumePostCredit(transaction, {
              businessProfileId: "business",
              problemId: "problem",
            }),
          ),
        ),
      );
      assert.equal(results.filter((result) => result.status === "consumed").length, 1);
      const credit = await database.prisma.postCredit.findUniqueOrThrow({
        where: { id: "free" },
      });
      assert.equal(credit.remaining, 1);
    } finally {
      await database.close();
    }
  });

  it("refunds a consumed credit only once", async () => {
    const database = await createTestDatabase();
    try {
      await database.prisma.postCredit.create({
        data: {
          id: "free",
          businessProfileId: "business",
          source: POST_CREDIT_SOURCES.FREE,
          remaining: BUSINESS_POST_CONFIG.freePostCredits - 1,
          updatedAt: new Date(),
        },
      });
      await database.prisma.problem.create({
        data: problemData("problem", "PENDING_REVIEW", "free"),
      });
      const first = await database.prisma.$transaction((transaction) =>
        refundProblemCredit(transaction, { problemId: "problem" }),
      );
      const second = await database.prisma.$transaction((transaction) =>
        refundProblemCredit(transaction, { problemId: "problem" }),
      );
      assert.equal(first, true);
      assert.equal(second, false);
      const credit = await database.prisma.postCredit.findUniqueOrThrow({
        where: { id: "free" },
      });
      assert.equal(credit.remaining, BUSINESS_POST_CONFIG.freePostCredits);
    } finally {
      await database.close();
    }
  });

  it("refunds an expired PREMIUM credit into the FREE batch", async () => {
    const database = await createTestDatabase();
    try {
      await database.prisma.postCredit.create({
        data: {
          id: "premium",
          businessProfileId: "business",
          source: POST_CREDIT_SOURCES.PREMIUM,
          remaining: 0,
          expiresAt: new Date("2025-12-31T00:00:00.000Z"),
          updatedAt: new Date(),
        },
      });

      it("does not refund a problem that was approved before rejection", async () => {
        const database = await createTestDatabase();
        try {
          await database.prisma.postCredit.create({
            data: {
              id: "free",
              businessProfileId: "business",
              source: POST_CREDIT_SOURCES.FREE,
              remaining: 0,
              updatedAt: new Date(),
            },
          });
          await database.prisma.problem.create({
            data: {
              ...problemData("problem", "PENDING_REVIEW", "free"),
              firstApprovedAt: new Date("2026-01-01T00:00:00.000Z"),
            },
          });
          assert.equal(
            await database.prisma.$transaction((transaction) =>
              refundProblemCredit(transaction, { problemId: "problem" }),
            ),
            false,
          );
          assert.equal(
            (await database.prisma.postCredit.findUniqueOrThrow({ where: { id: "free" } })).remaining,
            0,
          );
        } finally {
          await database.close();
        }
      });
      await database.prisma.problem.create({
        data: problemData("problem", "PENDING_REVIEW", "premium"),
      });
      const refunded = await database.prisma.$transaction((transaction) =>
        refundProblemCredit(transaction, {
          problemId: "problem",
          clock: fixedClock("2026-01-01T00:00:00.000Z"),
        }),
      );
      assert.equal(refunded, true);
      const free = await database.prisma.postCredit.findFirstOrThrow({
        where: { businessProfileId: "business", source: POST_CREDIT_SOURCES.FREE },
      });
      assert.equal(free.remaining, 1);
    } finally {
      await database.close();
    }
  });

  it("extends an active PREMIUM subscription and makes purchases idempotent", async () => {
    const database = await createTestDatabase();
    const clock = fixedClock("2026-01-01T00:00:00.000Z");
    try {
      await database.prisma.subscription.create({
        data: {
          businessProfileId: "business",
          package: "PREMIUM",
          startsAt: new Date("2025-12-01T00:00:00.000Z"),
          endsAt: new Date("2026-02-01T00:00:00.000Z"),
          updatedAt: new Date(),
        },
      });
      await database.prisma.$transaction((transaction) =>
        purchasePremium(transaction, {
          businessProfileId: "business",
          buyerId: "buyer",
          idempotencyKey: "premium-1",
          clock,
        }),
      );
      const subscription = await database.prisma.subscription.findUniqueOrThrow({
        where: { businessProfileId_package: { businessProfileId: "business", package: "PREMIUM" } },
      });
      assert.equal(subscription.endsAt.toISOString(), "2026-05-01T00:00:00.000Z");
      const premiumCharge = await database.prisma.platformCharge.findUniqueOrThrow({
        where: { idempotencyKey: "premium-1" },
      });
      assert.equal(premiumCharge.periodStartsAt?.toISOString(), "2026-02-01T00:00:00.000Z");
      assert.equal(premiumCharge.periodEndsAt?.toISOString(), "2026-05-01T00:00:00.000Z");
      assert.equal(premiumCharge.quantity, BUSINESS_POST_CONFIG.premiumPostCredits);
      const repeatedPremium = await database.prisma.$transaction((transaction) =>
        purchasePremium(transaction, {
          businessProfileId: "business",
          buyerId: "buyer",
          idempotencyKey: "premium-1",
          clock,
        }),
      );
      assert.equal(repeatedPremium.id, premiumCharge.id);
      assert.equal(
        await database.prisma.platformCharge.count({ where: { type: "PREMIUM" } }),
        1,
      );

      const first = await database.prisma.$transaction((transaction) =>
        purchasePostCredits(transaction, {
          businessProfileId: "business",
          buyerId: "buyer",
          quantity: 2,
          idempotencyKey: "post-1",
        }),
      );
      const second = await database.prisma.$transaction((transaction) =>
        purchasePostCredits(transaction, {
          businessProfileId: "business",
          buyerId: "buyer",
          quantity: 2,
          idempotencyKey: "post-1",
        }),
      );
      assert.equal(first.id, second.id);
      assert.equal(
        await database.prisma.platformCharge.count({ where: { idempotencyKey: "post-1" } }),
        1,
      );
      assert.equal(
        await database.prisma.postCredit.count({
          where: { businessProfileId: "business", source: POST_CREDIT_SOURCES.PURCHASED },
        }),
        1,
      );
      await database.prisma.$transaction((transaction) =>
        purchasePostCredits(transaction, {
          businessProfileId: "business",
          buyerId: "buyer",
          quantity: 1,
          idempotencyKey: "post-2",
        }),
      );
      assert.equal(
        await database.prisma.platformCharge.count({ where: { type: "POST_PURCHASE" } }),
        2,
      );
    } finally {
      await database.close();
    }
  });

  it("starts a new PREMIUM period at the purchase time", async () => {
    const database = await createTestDatabase();
    const clock = fixedClock("2026-01-01T00:00:00.000Z");
    try {
      const charge = await database.prisma.$transaction((transaction) =>
        purchasePremium(transaction, {
          businessProfileId: "business",
          buyerId: "buyer",
          idempotencyKey: "premium-new",
          clock,
        }),
      );
      assert.equal(charge.periodStartsAt?.toISOString(), "2026-01-01T00:00:00.000Z");
      assert.equal(charge.periodEndsAt?.toISOString(), "2026-04-01T00:00:00.000Z");
    } finally {
      await database.close();
    }
  });
});
