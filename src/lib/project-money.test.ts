import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PLATFORM_FEE_BASIS_POINTS } from "@/lib/project-config";
import { calculateProjectFinancialBreakdown } from "@/lib/project-money";

describe("calculateProjectFinancialBreakdown", () => {
  it("allocates odd VND amounts and rounding residuals to the final milestone", () => {
    const breakdown = calculateProjectFinancialBreakdown(
      10_000_001,
      [33, 33, 34],
      PLATFORM_FEE_BASIS_POINTS,
    );

    assert.deepEqual(
      breakdown.milestones.map(({ grossAmount }) => grossAmount),
      [3_300_000, 3_300_000, 3_400_001],
    );
    assert.deepEqual(
      breakdown.milestones.map(({ platformFee }) => platformFee),
      [495_000, 495_000, 510_000],
    );
    assert.equal(breakdown.totalPlatformFee, 1_500_000);
    assert.equal(
      breakdown.milestones.reduce((sum, milestone) => sum + milestone.platformFee, 0),
      breakdown.totalPlatformFee,
    );
    assert.equal(
      breakdown.milestones.reduce(
        (sum, milestone) => sum + milestone.teamAmount + milestone.platformFee,
        0,
      ),
      10_000_001,
    );
  });

  it("does not lose or create VND when many milestone shares need rounding", () => {
    const breakdown = calculateProjectFinancialBreakdown(
      1_000_003,
      [17, 19, 21, 43],
      PLATFORM_FEE_BASIS_POINTS,
    );

    assert.equal(
      breakdown.milestones.reduce((sum, milestone) => sum + milestone.grossAmount, 0),
      breakdown.totalAmount,
    );
    assert.equal(
      breakdown.milestones.reduce((sum, milestone) => sum + milestone.teamAmount, 0) +
        breakdown.totalPlatformFee,
      breakdown.totalAmount,
    );
  });

  it("rounds a half-VND platform fee upward", () => {
    const breakdown = calculateProjectFinancialBreakdown(
      10_000_010,
      [100],
      PLATFORM_FEE_BASIS_POINTS,
    );
    assert.equal(breakdown.totalPlatformFee, 1_500_002);
    assert.equal(
      breakdown.totalTeamAmount + breakdown.totalPlatformFee,
      breakdown.totalAmount,
    );
  });

  it("rejects incomplete percentages and unsafe monetary values", () => {
    assert.throws(
      () =>
        calculateProjectFinancialBreakdown(
          100_000,
          [30, 30],
          PLATFORM_FEE_BASIS_POINTS,
        ),
      /tổng bằng 100%/,
    );
    assert.throws(
      () =>
        calculateProjectFinancialBreakdown(
          Number.MAX_SAFE_INTEGER + 1,
          [100],
          PLATFORM_FEE_BASIS_POINTS,
        ),
      /số nguyên dương an toàn/,
    );
  });
});
