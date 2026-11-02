export type ProjectNotificationRole = "BUSINESS" | "STUDENT";

export function getProjectNotificationHref(
  role: ProjectNotificationRole,
  projectId: string,
): string {
  const audiencePath = role === "BUSINESS" ? "business" : "student";
  return `/${audiencePath}/projects/${encodeURIComponent(projectId)}`;
}
