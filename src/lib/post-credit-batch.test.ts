import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { POST_CREDIT_SOURCES } from "@/lib/business-post-config";
import { createTestDatabase } from "@/lib/test-database";

const clock = { now: () => new Date("2026-10-28T10:00:00.000Z") };

describe("PostCredit batch consumption", () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let submitProblemForReview: typeof import("@/lib/post-credits")["submitProblemForReview"];
  let refundProblemCredit: typeof import("@/lib/post-credits")["refundProblemCredit"];

  beforeEach(async () => {
    process.env.DATABASE_URL ??= "file:/tmp/unibridge-post-credit-batch-import.db";
    ({ submitProblemForReview, refundProblemCredit } = await import("@/lib/post-credits"));
    database = await createTestDatabase("unibridge-post-credit-batch", {
      seedBusinessContext: true,
    });
  });

  afterEach(async () => {
    await database.close();
  });

  async function createProblem(id: string) {
    await database.prisma.problem.create({
      data: {
        id,
        businessProfileId: "business",
        title: id,
        slug: id,
        description: "Mô tả",
        goal: "Mục tiêu",
        field: "Công nghệ",
        requirements: "Yêu cầu",
        expectedDuration: "1 tuần",
        status: "DRAFT",
      },
    });
  }

  async function submit(problemId: string) {
    return database.prisma.$transaction((transaction) =>
      submitProblemForReview(transaction, {
        businessProfileId: "business",
        problemId,
        clock,
      }),
    );
  }

  it("uses a FREE batch for two Problems, rejects a third, and refunds the denied Problem once", async () => {
    await database.prisma.postCredit.create({
      data: {
        id: "free-batch",
        businessProfileId: "business",
        source: POST_CREDIT_SOURCES.FREE,
        remaining: 2,
        updatedAt: clock.now(),
      },
    });
    await Promise.all(["free-problem-1", "free-problem-2", "free-problem-3"].map(createProblem));

    assert.equal((await submit("free-problem-1")).status, "submitted");
    assert.equal((await submit("free-problem-2")).status, "submitted");
    assert.deepEqual(await submit("free-problem-3"), { status: "no_credits" });
    const consumedProblems = await database.prisma.problem.findMany({
      where: { consumedCreditId: "free-batch" },
      orderBy: { id: "asc" },
      select: { id: true },
    });
    assert.deepEqual(consumedProblems.map(({ id }) => id), ["free-problem-1", "free-problem-2"]);
    assert.equal(
      (await database.prisma.postCredit.findUniqueOrThrow({ where: { id: "free-batch" } })).remaining,
      0,
    );
    assert.equal(
      (await database.prisma.problem.findUniqueOrThrow({ where: { id: "free-problem-3" } })).status,
      "DRAFT",
    );

    const firstRefund = await database.prisma.$transaction(async (transaction) => {
      await transaction.problem.update({
        where: { id: "free-problem-1" },
        data: { status: "REJECTED" },
      });
      return refundProblemCredit(transaction, { problemId: "free-problem-1", clock });
    });
    const duplicateRefund = await database.prisma.$transaction((transaction) =>
      refundProblemCredit(transaction, { problemId: "free-problem-1", clock }),
    );
    assert.equal(firstRefund, true);
    assert.equal(duplicateRefund, false);
    assert.equal(
      (await database.prisma.postCredit.findUniqueOrThrow({ where: { id: "free-batch" } })).remaining,
      1,
    );
    assert.equal(
      (await database.prisma.problem.findUniqueOrThrow({ where: { id: "free-problem-2" } })).consumedCreditId,
      "free-batch",
    );
  });

  it("allows only one of two concurrent Problem submissions to use the last credit", async () => {
    await database.prisma.postCredit.create({
      data: {
        id: "last-free-credit",
        businessProfileId: "business",
        source: POST_CREDIT_SOURCES.FREE,
        remaining: 1,
        updatedAt: clock.now(),
      },
    });
    await Promise.all(["concurrent-problem-a", "concurrent-problem-b"].map(createProblem));

    const results = await Promise.allSettled([
      submit("concurrent-problem-a"),
      submit("concurrent-problem-b"),
    ]);
    const submittedCount = results.filter(
      (result) => result.status === "fulfilled" && result.value.status === "submitted",
    ).length;
    assert.equal(submittedCount, 1);
    const problems = await database.prisma.problem.findMany({
      where: { id: { in: ["concurrent-problem-a", "concurrent-problem-b"] } },
      orderBy: { id: "asc" },
      select: { status: true, consumedCreditId: true },
    });
    assert.equal(problems.filter(({ status }) => status === "PENDING_REVIEW").length, 1);
    assert.equal(problems.filter(({ status }) => status === "DRAFT").length, 1);
    assert.equal(
      (await database.prisma.postCredit.findUniqueOrThrow({ where: { id: "last-free-credit" } })).remaining,
      0,
    );
    assert.equal(problems.filter(({ consumedCreditId }) => consumedCreditId === "last-free-credit").length, 1);
  });

  it("allows a PREMIUM batch to be associated with ten Problems", async () => {
    await database.prisma.postCredit.create({
      data: {
        id: "premium-batch",
        businessProfileId: "business",
        source: POST_CREDIT_SOURCES.PREMIUM,
        remaining: 10,
        expiresAt: new Date("2026-12-01T00:00:00.000Z"),
        updatedAt: clock.now(),
      },
    });
    const problemIds = Array.from({ length: 10 }, (_, index) => `premium-problem-${index + 1}`);
    await Promise.all(problemIds.map(createProblem));
    for (const problemId of problemIds) {
      assert.equal((await submit(problemId)).status, "submitted");
    }

    assert.equal(
      await database.prisma.problem.count({ where: { consumedCreditId: "premium-batch" } }),
      10,
    );
    const credit = await database.prisma.postCredit.findUniqueOrThrow({
      where: { id: "premium-batch" },
      include: { consumedProblems: { select: { id: true } } },
    });
    assert.equal(credit.consumedProblems.length, 10);
    assert.equal(credit.remaining, 0);
  });
});
