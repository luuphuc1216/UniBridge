import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { WorkspaceView } from "@/components/workspace/workspace-view";
import { findAuthorizedWorkspace } from "@/lib/workspace-access";

export const instant = false;

export default async function StudentWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "STUDENT") {
    notFound();
  }
  const { id } = await params;
  const problem = await findAuthorizedWorkspace(id, session.user.id, session.user.role);
  const application = problem?.applications[0];
  if (!problem || !application) {
    notFound();
  }

  return (
    <WorkspaceView
      data={{
        problem: {
          id: problem.id,
          title: problem.title,
          status: problem.status,
          description: problem.description,
          goal: problem.goal,
          companyName: problem.businessProfile.companyName,
          teamName: application.team.name,
        },
        messages: problem.workspaceMessages,
        proposals: application.proposals,
        isBusiness: false,
      }}
    />
  );
}
