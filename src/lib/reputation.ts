import { reputationConfig } from "@/lib/reputation-config";

export type ReputationReview = { rating: number };

export type ReputationMilestone = {
  dueAt: Date | null;
  acceptedAt: Date | null;
  submittedAt: Date | null;
};

export type ReputationProject = {
  status: string;
  hasPaidDeposit: boolean;
  milestones: ReputationMilestone[];
};

export type TeamReputation = {
  ratingAverage: number | null;
  smoothedRatingAverage: number;
  ratingCount: number;
  positiveReviewCount: number;
  completedProjectCount: number;
  fundedCancelledProjectCount: number;
  eligibleProjectCount: number;
  completionRate: number | null;
  onTimeMilestoneCount: number;
  eligibleMilestoneCount: number;
  onTimeRate: number | null;
  fundedProjectCount: number;
  transactionCount: number;
  score: number | null;
};

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

export function calculateTeamReputation({
  reviews,
  projects,
  transactionCount,
}: {
  reviews: ReputationReview[];
  projects: ReputationProject[];
  transactionCount: number;
}): TeamReputation {
  const validRatings = reviews
    .map(({ rating }) => rating)
    .filter((rating) => Number.isFinite(rating) && rating >= 1 && rating <= reputationConfig.maximumRating);
  const ratingCount = validRatings.length;
  const ratingAverage =
    ratingCount === 0
      ? null
      : validRatings.reduce((sum, rating) => sum + rating, 0) / ratingCount;
  const smoothedRatingAverage =
    (validRatings.reduce((sum, rating) => sum + rating, 0) +
      reputationConfig.ratingSmoothing.priorAverage *
        reputationConfig.ratingSmoothing.priorReviewCount) /
    (ratingCount + reputationConfig.ratingSmoothing.priorReviewCount);
  const positiveReviewCount = validRatings.filter(
    (rating) => rating >= reputationConfig.positiveRatingMinimum,
  ).length;

  const completedProjects = projects.filter(({ status }) => status === "COMPLETED");
  const fundedCancelledProjects = projects.filter(
    ({ status, hasPaidDeposit }) => status === "CANCELLED" && hasPaidDeposit,
  );
  const eligibleProjectCount = completedProjects.length + fundedCancelledProjects.length;
  const completionRate =
    eligibleProjectCount === 0 ? null : completedProjects.length / eligibleProjectCount;
  const completedMilestones = completedProjects.flatMap(({ milestones }) => milestones);
  const dueMilestones = completedMilestones.filter(({ dueAt }) => dueAt !== null);
  const onTimeMilestoneCount = dueMilestones.filter(({ dueAt, acceptedAt, submittedAt }) => {
    if (!dueAt) return false;
    const completionAt = acceptedAt ?? submittedAt;
    return completionAt !== null && completionAt <= dueAt;
  }).length;
  const onTimeRate =
    dueMilestones.length === 0 ? null : onTimeMilestoneCount / dueMilestones.length;
  const fundedProjectCount = projects.filter(
    ({ status, hasPaidDeposit }) =>
      hasPaidDeposit && (status === "COMPLETED" || status === "CANCELLED"),
  ).length;

  const hasReputationData = eligibleProjectCount > 0 || ratingCount > 0;
  const weights = reputationConfig.weights;
  const rawScore = hasReputationData
    ? (smoothedRatingAverage / reputationConfig.maximumRating) * 100 * (weights.rating / 100) +
      (completionRate ?? 0) * 100 * (weights.completion / 100) +
      (onTimeRate ?? 0) * 100 * (weights.onTime / 100) +
      (ratingCount === 0 ? 0 : (positiveReviewCount / ratingCount) * 100) *
        (weights.positiveReviews / 100) +
      Math.min(
        fundedProjectCount / reputationConfig.fundedProjectHistorySaturation,
        1,
      ) *
        100 *
        (weights.fundedProjectHistory / 100)
    : null;

  return {
    ratingAverage: ratingAverage === null ? null : roundToOneDecimal(ratingAverage),
    smoothedRatingAverage: roundToOneDecimal(smoothedRatingAverage),
    ratingCount,
    positiveReviewCount,
    completedProjectCount: completedProjects.length,
    fundedCancelledProjectCount: fundedCancelledProjects.length,
    eligibleProjectCount,
    completionRate: completionRate === null ? null : roundToOneDecimal(completionRate * 100),
    onTimeMilestoneCount,
    eligibleMilestoneCount: dueMilestones.length,
    onTimeRate: onTimeRate === null ? null : roundToOneDecimal(onTimeRate * 100),
    fundedProjectCount,
    transactionCount: Math.max(0, transactionCount),
    score: rawScore === null ? null : roundToOneDecimal(rawScore),
  };
}
