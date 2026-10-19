export type MilestoneAllocation = {
  grossAmount: number;
  businessFee: number;
  studentFee: number;
  platformFee: number;
  teamAmount: number;
  depositAmount: number;
};

export type ProjectFinancialBreakdown = {
  totalAmount: number;
  totalBusinessFee: number;
  totalStudentFee: number;
  totalPlatformFee: number;
  totalDeposit: number;
  totalTeamAmount: number;
  businessFeeBasisPoints: number | null;
  studentFeeBasisPoints: number | null;
  platformFeeBasisPoints: number;
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

function proportionalShare(total: number, numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  const base = Math.floor(total / denominator) * numerator;
  const remainder = Math.floor(((total % denominator) * numerator) / denominator);
  return base + remainder;
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

function validateMilestonePercentages(milestonePercentages: number[]): void {
  if (
    milestonePercentages.length === 0 ||
    milestonePercentages.some((percent) => !Number.isInteger(percent) || percent <= 0) ||
    milestonePercentages.reduce((sum, percent) => sum + percent, 0) !== 100
  ) {
    throw new Error("Tỷ lệ Milestone phải là các số nguyên dương và tổng bằng 100%.");
  }
}

function validateFeeRate(basisPoints: number, label: string): void {
  if (!Number.isInteger(basisPoints) || basisPoints < 0 || basisPoints > 10_000) {
    throw new Error(`${label} không hợp lệ.`);
  }
}

export function calculateProjectFinancialBreakdown(
  totalAmount: number,
  milestonePercentages: number[],
  businessFeeBasisPoints: number,
  studentFeeBasisPoints: number,
): ProjectFinancialBreakdown {
  assertSafePositiveInteger(totalAmount, "Tổng chi phí");
  validateMilestonePercentages(milestonePercentages);
  validateFeeRate(businessFeeBasisPoints, "Tỷ lệ phụ phí doanh nghiệp");
  validateFeeRate(studentFeeBasisPoints, "Tỷ lệ phí sinh viên");

  const platformFeeBasisPoints = businessFeeBasisPoints + studentFeeBasisPoints;
  if (platformFeeBasisPoints > 10_000) {
    throw new Error("Tổng tỷ lệ phí nền tảng không hợp lệ.");
  }
  const totalPlatformFee = roundedFee(totalAmount, platformFeeBasisPoints);
  const totalBusinessFee = proportionalShare(
    totalPlatformFee,
    businessFeeBasisPoints,
    platformFeeBasisPoints,
  );
  const totalStudentFee = totalPlatformFee - totalBusinessFee;
  const grossAmounts = allocateByPercent(totalAmount, milestonePercentages);
  const businessFees = allocateByPercent(totalBusinessFee, milestonePercentages);
  const studentFees = allocateByPercent(totalStudentFee, milestonePercentages);
  const milestones = grossAmounts.map((grossAmount, index) => {
    const businessFee = businessFees[index];
    const studentFee = studentFees[index];
    if (businessFee === undefined || studentFee === undefined) {
      throw new Error("Không thể phân bổ phí cho Milestone.");
    }
    const platformFee = businessFee + studentFee;
    return {
      grossAmount,
      businessFee,
      studentFee,
      platformFee,
      teamAmount: grossAmount - studentFee,
      depositAmount: grossAmount + businessFee,
    };
  });
  const totalTeamAmount = milestones.reduce((sum, milestone) => sum + milestone.teamAmount, 0);
  const totalDeposit = totalAmount + totalBusinessFee;

  if (
    !Number.isSafeInteger(totalDeposit) ||
    milestones.reduce((sum, milestone) => sum + milestone.depositAmount, 0) !== totalDeposit ||
    totalTeamAmount + totalPlatformFee !== totalDeposit ||
    milestones.some(
      ({ depositAmount, teamAmount, platformFee }) =>
        depositAmount !== teamAmount + platformFee,
    )
  ) {
    throw new Error("Phân bổ giao dịch không cân bằng.");
  }

  return {
    totalAmount,
    totalBusinessFee,
    totalStudentFee,
    totalPlatformFee,
    totalDeposit,
    totalTeamAmount,
    businessFeeBasisPoints,
    studentFeeBasisPoints,
    platformFeeBasisPoints,
    milestones,
  };
}

export function calculateLegacyProjectFinancialBreakdown(
  totalAmount: number,
  milestonePercentages: number[],
  platformFeeBasisPoints: number,
): ProjectFinancialBreakdown {
  assertSafePositiveInteger(totalAmount, "Tổng chi phí");
  validateMilestonePercentages(milestonePercentages);
  validateFeeRate(platformFeeBasisPoints, "Tỷ lệ phí nền tảng");

  const totalPlatformFee = roundedFee(totalAmount, platformFeeBasisPoints);
  const grossAmounts = allocateByPercent(totalAmount, milestonePercentages);
  const milestoneFees = allocateByPercent(totalPlatformFee, milestonePercentages);
  const milestones = grossAmounts.map((grossAmount, index) => {
    const platformFee = milestoneFees[index];
    if (platformFee === undefined) {
      throw new Error("Không thể phân bổ phí cho Milestone.");
    }
    return {
      grossAmount,
      businessFee: 0,
      studentFee: platformFee,
      platformFee,
      teamAmount: grossAmount - platformFee,
      depositAmount: grossAmount,
    };
  });
  const totalTeamAmount = milestones.reduce((sum, milestone) => sum + milestone.teamAmount, 0);

  if (totalTeamAmount + totalPlatformFee !== totalAmount) {
    throw new Error("Phân bổ giao dịch không cân bằng.");
  }

  return {
    totalAmount,
    totalBusinessFee: 0,
    totalStudentFee: totalPlatformFee,
    totalPlatformFee,
    totalDeposit: totalAmount,
    totalTeamAmount,
    businessFeeBasisPoints: null,
    studentFeeBasisPoints: null,
    platformFeeBasisPoints,
    milestones,
  };
}

export function getMilestoneReleaseIdempotencyKey(milestoneId: string): string {
  return `release:${milestoneId}`;
}

export function shouldRecordMilestoneRelease(
  existingRelease: { id: string } | null,
): boolean {
  return existingRelease === null;
}
