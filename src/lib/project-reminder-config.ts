export const projectReminderConfig = {
  businessAcceptanceResponseHours: 72,
  pendingChangeRequestResponseHours: 72,
  extensionMaxDays: 30,
  pauseMaxDays: 30,
} as const;

export const projectReminderHourMs = 60 * 60 * 1000;

// Business fees recorded at deposit remain non-refundable unless platform policy changes.
export const refundableBusinessFeeBasisPoints = 0;
