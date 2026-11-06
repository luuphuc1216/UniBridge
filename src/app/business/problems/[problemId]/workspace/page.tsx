import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { WorkspaceView } from "@/components/workspace/workspace-view";
import { findAuthorizedWorkspace } from "@/lib/workspace-access";
import {
  ensureBusinessPrototypeReminders,
  getWorkspacePrototypeOverdueStatus,
} from "@/lib/prototype-reminders";
import { markWorkspaceRead } from "@/lib/workspace-messages";

export const instant = false;

export default async function BusinessWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ problemId: string }>;
  searchParams: Promise<{ applicationId?: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "BUSINESS") {
    notFound();
  }
  const { problemId } = await params;
  const { applicationId } = await searchParams;
  const problem = await findAuthorizedWorkspace(
    problemId,
    session.user.id,
    session.user.role,
    applicationId,
  );
  const application = problem?.applications[0];
  if (!problem || !application) {
    notFound();
  }
  await markWorkspaceRead(application.id, session.user.id);
  const now = new Date();
  try {
    await ensureBusinessPrototypeReminders(problem.id, session.user.id, {
      clock: { now: () => now },
    });
  } catch (error) {
    console.error("Không thể tạo nhắc nhở Prototype cho doanh nghiệp:", error);
  }
  const overdue = getWorkspacePrototypeOverdueStatus(
    { problem, trialBriefVersions: problem.trialBriefVersions, proposals: application.proposals },
    "BUSINESS",
    now,
  );

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
          applicationId: application.id,
          trialBriefLockedAt: problem.trialBriefLockedAt,
          prototypeLegacy: problem.prototypeLegacy,
          evaluationResult: problem.evaluationResult,
          implementationDecision: problem.implementationDecision,
          prototypeRevisionRequestCount: problem.prototypeRevisionRequestCount,
          canRespondToTrialBrief: false,
          overdue,
        },
        trialBriefVersions: problem.trialBriefVersions,
        messages: problem.workspaceMessages,
        proposals: application.proposals,
        project: application.project,
        isBusiness: true,
      }}
    />
  );
}
