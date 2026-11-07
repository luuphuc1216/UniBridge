export const AI_LIMITS = {
  daily: 10,
  monthly: 100,
  timeoutMs: 15_000,
  maxInputChars: 4_000,
  maxOutputChars: 8_000,
  maxOutputTokens: 2_000,
} as const;

export const AI_FEATURES = {
  problemDraft: "PROBLEM_DRAFT",
  applicationExplanation: "APPLICATION_EXPLANATION",
  problemReview: "PROBLEM_REVIEW",
} as const;

export const AI_PLATFORM_LIMITS = {
  problemReviewsPerProblem: 5,
  problemReviewWindowMs: 24 * 60 * 60 * 1000,
  daily: 10,
  monthly: 100,
} as const;

export type AiFeature = (typeof AI_FEATURES)[keyof typeof AI_FEATURES];
