import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  businessFeeRate,
  legacyPlatformFeeRate,
  studentFeeRate,
} from "@/lib/project-config";
import {
  calculateLegacyProjectFinancialBreakdown,
  calculateProjectFinancialBreakdown,
  getMilestoneReleaseIdempotencyKey,
  shouldRecordMilestoneRelease,
} from "@/lib/project-money";

function assertBalanced(
  breakdown: ReturnType<typeof calculateProjectFinancialBreakdown>,
): void {
  assert.equal(
    breakdown.milestones.reduce((sum, milestone) => sum + milestone.grossAmount, 0),
    breakdown.totalAmount,
  );
  assert.equal(
    breakdown.milestones.reduce((sum, milestone) => sum + milestone.businessFee, 0),
    breakdown.totalBusinessFee,
  );
  assert.equal(
    breakdown.milestones.reduce((sum, milestone) => sum + milestone.studentFee, 0),
    breakdown.totalStudentFee,
  );
  assert.equal(
    breakdown.milestones.reduce((sum, milestone) => sum + milestone.platformFee, 0),
    breakdown.totalPlatformFee,
  );
  assert.equal(
    breakdown.totalBusinessFee + breakdown.totalStudentFee,
    breakdown.totalPlatformFee,
  );
  assert.equal(
    breakdown.milestones.reduce((sum, milestone) => sum + milestone.depositAmount, 0),
    breakdown.totalDeposit,
  );
  assert.equal(
    breakdown.totalTeamAmount + breakdown.totalPlatformFee,
    breakdown.totalDeposit,
  );
  for (const milestone of breakdown.milestones) {
    assert.equal(
      milestone.teamAmount + milestone.platformFee,
      milestone.depositAmount,
    );
    assert.equal(
      milestone.businessFee + milestone.studentFee,
      milestone.platformFee,
    );
  }
}

function calculate(totalAmount: number, percentages: number[]) {
  return calculateProjectFinancialBreakdown(
    totalAmount,
    percentages,
    businessFeeRate,
    studentFeeRate,
  );
}

describe("calculateProjectFinancialBreakdown", () => {
  it("allocates 10,000,001 VND across 33/33/34 percent with the final remainder", () => {
    const breakdown = calculate(10_000_001, [33, 33, 34]);

    assert.deepEqual(
      breakdown.milestones.map(({ grossAmount }) => grossAmount),
      [3_300_000, 3_300_000, 3_400_001],
    );
    assert.deepEqual(
      breakdown.milestones.map(({ businessFee }) => businessFee),
      [330_000, 330_000, 340_000],
    );
    assert.deepEqual(
      breakdown.milestones.map(({ studentFee }) => studentFee),
      [165_000, 165_000, 170_000],
    );
    assert.deepEqual(
      breakdown.milestones.map(({ teamAmount }) => teamAmount),
      [3_135_000, 3_135_000, 3_230_001],
    );
    assert.equal(breakdown.totalBusinessFee, 1_000_000);
    assert.equal(breakdown.totalStudentFee, 500_000);
    assert.equal(breakdown.totalPlatformFee, 1_500_000);
    assert.equal(breakdown.totalDeposit, 11_000_001);
    assertBalanced(breakdown);
  });

  it("allocates 10,000,001 VND across 44/56 percent", () => {
    const breakdown = calculate(10_000_001, [44, 56]);

    assert.deepEqual(
      breakdown.milestones.map(({ grossAmount }) => grossAmount),
      [4_400_000, 5_600_001],
    );
    assert.deepEqual(
      breakdown.milestones.map(({ depositAmount }) => depositAmount),
      [4_840_000, 6_160_001],
    );
    assert.deepEqual(
      breakdown.milestones.map(({ teamAmount }) => teamAmount),
      [4_180_000, 5_320_001],
    );
    assertBalanced(breakdown);
  });

  it("handles a single milestone and rounds the aggregate platform fee only once", () => {
    const breakdown = calculate(35, [100]);

    assert.equal(breakdown.totalBusinessFee, 3);
    assert.equal(breakdown.totalStudentFee, 2);
    assert.equal(breakdown.totalPlatformFee, 5);
    assert.deepEqual(breakdown.milestones, [
      {
        grossAmount: 35,
        businessFee: 3,
        studentFee: 2,
        platformFee: 5,
        teamAmount: 33,
        depositAmount: 38,
      },
    ]);
    assertBalanced(breakdown);
  });

  it("keeps very small VND amounts balanced", () => {
    for (const amount of [1, 2, 7, 99]) {
      assertBalanced(calculate(amount, [33, 33, 34]));
    }
  });

  it("keeps previously funded projects on the legacy 15 percent calculation", () => {
    const breakdown = calculateLegacyProjectFinancialBreakdown(
      10_000_001,
      [33, 33, 34],
      legacyPlatformFeeRate,
    );

    assert.equal(breakdown.totalDeposit, 10_000_001);
    assert.equal(breakdown.totalBusinessFee, 0);
    assert.equal(breakdown.totalPlatformFee, 1_500_000);
    assert.equal(breakdown.businessFeeBasisPoints, null);
    assert.equal(breakdown.studentFeeBasisPoints, null);
    assert.deepEqual(
      breakdown.milestones.map(({ teamAmount }) => teamAmount),
      [2_805_000, 2_805_000, 2_890_001],
    );
    assertBalanced(breakdown);
  });

  it("keeps milestone release idempotency keys stable across retries", () => {
    const firstAttempt = getMilestoneReleaseIdempotencyKey("milestone-1");
    const retry = getMilestoneReleaseIdempotencyKey("milestone-1");

    assert.equal(firstAttempt, retry);
    assert.notEqual(firstAttempt, getMilestoneReleaseIdempotencyKey("milestone-2"));
  });

  it("does not create another payout once a milestone release is recorded", () => {
    assert.equal(shouldRecordMilestoneRelease(null), true);
    assert.equal(shouldRecordMilestoneRelease({ id: "existing-release" }), false);
  });

  it("preserves the money invariant for deterministic randomized odd totals and milestone splits", () => {
    let seed = 0x51f15e;
    const nextRandom = () => {
      seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
      return seed;
    };

    for (let testCase = 0; testCase < 1_000; testCase += 1) {
      const milestoneCount = 1 + (nextRandom() % 8);
      let remainingPercent = 100;
      const percentages: number[] = [];
      for (let index = 0; index < milestoneCount - 1; index += 1) {
        const maxPercent = remainingPercent - (milestoneCount - index - 1);
        const percent = 1 + (nextRandom() % maxPercent);
        percentages.push(percent);
        remainingPercent -= percent;
      }
      percentages.push(remainingPercent);

      let amount = 1 + (nextRandom() % 100_000_000);
      if (amount % 2 === 0) amount += 1;
      assertBalanced(calculate(amount, percentages));
    }
  });

  it("rejects incomplete percentages and unsafe monetary values", () => {
    assert.throws(() => calculate(100_000, [30, 30]), /tổng bằng 100%/);
    assert.throws(
      () => calculate(Number.MAX_SAFE_INTEGER + 1, [100]),
      /số nguyên dương an toàn/,
    );
  });
});
