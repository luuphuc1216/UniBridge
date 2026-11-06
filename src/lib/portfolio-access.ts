export type PortfolioViewer = { userId: string; role: string } | null;
export type PortfolioItemAccess = { isVisible: boolean; teamId: string };
export type TeamMembershipAccess = { isOwner: boolean; isLead: boolean };

export function canViewPortfolioFile(input: {
  viewer: PortfolioViewer;
  item: PortfolioItemAccess;
  teamMembership: TeamMembershipAccess | null;
}): boolean {
  if (!input.viewer) return false;
  if (input.item.isVisible) return true;
  return input.viewer.role === "ADMIN" || Boolean(
    input.teamMembership?.isOwner || input.teamMembership?.isLead,
  );
}
