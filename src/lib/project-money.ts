export type MilestoneAllocation = {
  grossAmount: number;
  platformFee: number;
  teamAmount: number;
};

export type ProjectFinancialBreakdown = {
  totalAmount: number;
  totalPlatformFee: number;
  totalTeamAmount: number;
  milestones: MilestoneAllocation[];
};

function assertSafePositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} phải là số nguyên dương an toàn.`);
  }
}

function wholeVndShare(total: number, percent: number): number {
  const base = Math.floor(total / 100) * percent;
  const remainder = Math.floor(((total % 100) * percent) / 100);
  return base + remainder;
}

function roundedFee(total: number, basisPoints: number): number {
  // Round the total fee half up to the nearest VND before distributing it.
  const base = Math.floor(total / 10_000) * basisPoints;
  const fractionalNumerator = (total % 10_000) * basisPoints;
  const wholeFraction = Math.floor(fractionalNumerator / 10_000);
  const remainder = fractionalNumerator % 10_000;
  return base + wholeFraction + (remainder >= 5_000 ? 1 : 0);
}

function allocateByPercent(total: number, percentages: number[]): number[] {
  let allocated = 0;
  return percentages.map((percent, index) => {
    if (index === percentages.length - 1) {
      return total - allocated;
    }
    const amount = wholeVndShare(total, percent);
    allocated += amount;
    return amount;
  });
}

export function calculateProjectFinancialBreakdown(
  totalAmount: number,
  milestonePercentages: number[],
  platformFeeBasisPoints: number,
): ProjectFinancialBreakdown {
  assertSafePositiveInteger(totalAmount, "Tổng chi phí");
  if (
    milestonePercentages.length === 0 ||
    milestonePercentages.some((percent) => !Number.isInteger(percent) || percent <= 0) ||
    milestonePercentages.reduce((sum, percent) => sum + percent, 0) !== 100
  ) {
    throw new Error("Tỷ lệ Milestone phải là các số nguyên dương và tổng bằng 100%.");
  }
  if (
    !Number.isInteger(platformFeeBasisPoints) ||
    platformFeeBasisPoints < 0 ||
    platformFeeBasisPoints > 10_000
  ) {
    throw new Error("Tỷ lệ phí nền tảng không hợp lệ.");
  }

  const totalPlatformFee = roundedFee(totalAmount, platformFeeBasisPoints);
  const grossAmounts = allocateByPercent(totalAmount, milestonePercentages);
  // Earlier shares round down; assign the full remainder to the final Milestone to keep the ledger exact.
  const milestoneFees = allocateByPercent(totalPlatformFee, milestonePercentages);
  const milestones = grossAmounts.map((grossAmount, index) => ({
    grossAmount,
    platformFee: milestoneFees[index],
    teamAmount: grossAmount - milestoneFees[index],
  }));
  const totalTeamAmount = milestones.reduce((sum, milestone) => sum + milestone.teamAmount, 0);

  if (totalTeamAmount + totalPlatformFee !== totalAmount) {
    throw new Error("Phân bổ giao dịch không cân bằng.");
  }

  return { totalAmount, totalPlatformFee, totalTeamAmount, milestones };
}
