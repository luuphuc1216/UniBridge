import assert from "node:assert/strict";
import { describe, it } from "node:test";
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
import { createTestDatabase as createMigratedTestDatabase } from "@/lib/test-database";

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
  return createMigratedTestDatabase("unibridge-post-credits", {
    seedBusinessContext: true,
  });
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
