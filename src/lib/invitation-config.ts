export const INVITATION_RESPONSE_DAYS = 5;
export const INVITATION_REMINDER_DAYS = 3;

export function getInvitationDeadline(now = new Date()) {
  return new Date(now.getTime() + INVITATION_RESPONSE_DAYS * 24 * 60 * 60 * 1000);
}

export function getInvitationReminderAt(now = new Date()) {
  return new Date(now.getTime() + INVITATION_REMINDER_DAYS * 24 * 60 * 60 * 1000);
}
