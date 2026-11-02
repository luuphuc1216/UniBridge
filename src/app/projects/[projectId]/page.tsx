import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { findAccessibleProject } from "@/lib/project-access";
import { getProjectNotificationHref } from "@/lib/project-notification-links";

export const instant = false;

export default async function LegacyProjectNotificationPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const session = await auth();
  if (
    !session?.user ||
    (session.user.role !== "BUSINESS" && session.user.role !== "STUDENT")
  ) {
    notFound();
  }

  const { projectId } = await params;
  const project = await findAccessibleProject(
    projectId,
    session.user.id,
    session.user.role,
  );
  if (!project) notFound();

  redirect(getProjectNotificationHref(session.user.role, project.id));
}
