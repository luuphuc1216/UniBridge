export function canReadWorkspaceMessage(
  messageApplicationId: string | null,
  requestedApplicationId: string,
): boolean {
  return messageApplicationId === requestedApplicationId;
}

export function getLegacyMessageApplicationId(
  selectedApplicationIds: string[],
): string | null {
  return selectedApplicationIds.length === 1 ? selectedApplicationIds[0] : null;
}

export function isApplicationTeamMember(
  team: { ownerId: string; memberUserIds: string[] },
  userId: string,
): boolean {
  return team.ownerId === userId || team.memberUserIds.includes(userId);
}
