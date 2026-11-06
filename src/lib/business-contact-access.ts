export function canViewBusinessPrivateContact(input: {
  viewer: { userId: string; role: string } | null;
  businessOwnerId: string;
  hasSelectedApplication: boolean;
}): boolean {
  if (!input.viewer) return false;
  return (
    input.viewer.role === "ADMIN" ||
    input.viewer.userId === input.businessOwnerId ||
    input.hasSelectedApplication
  );
}
