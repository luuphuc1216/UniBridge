export function canRespondForTeam(teamOwnerId: string | null, userId: string): boolean {
  return teamOwnerId === userId;
}
