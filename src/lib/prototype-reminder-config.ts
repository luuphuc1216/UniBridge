export const prototypeReminderConfig = {
  adminHandoffDelayDays: 2,
  businessEvaluationDelayDays: 3,
  implementationDecisionDelayDays: 5,
  groupSubmissionReminderIntervalDays: 3,
  groupSubmissionReminderLimit: 3,
} as const;

export const prototypeReminderDayMs = 24 * 60 * 60 * 1000;
