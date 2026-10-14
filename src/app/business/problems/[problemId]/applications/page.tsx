import Link from "next/link";
import { notFound } from "next/navigation";
import { ApplicationComparison } from "@/components/business/application-comparison";
import { activeApplicationsWhere } from "@/lib/applications";
import { requireBusinessProfile } from "@/lib/business-access";
import { prisma } from "@/lib/prisma";

export const instant = false;

export default async function BusinessProblemApplicationsPage({
  params,
}: {
  params: Promise<{ problemId: string }>;
}) {
  const { problemId } = await params;
  const { businessProfileId } = await requireBusinessProfile();
  const problem = await prisma.problem.findFirst({
    where: { id: problemId, businessProfileId },
    include: {
      skills: { include: { skill: { select: { name: true } } } },
      applications: {
        where: activeApplicationsWhere,
        orderBy: { submittedAt: "asc" },
        include: {
          team: {
            include: {
              skills: { include: { skill: { select: { name: true } } } },
              memberships: { orderBy: [{ isLead: "desc" }, { joinedAt: "asc" }] },
              projects: { select: { title: true } },
            },
          },
        },
      },
    },
  });
  if (
    !problem ||
    !["APPROVED", "PUBLISHED", "TEAM_SELECTED"].includes(problem.status)
  ) {
    notFound();
  }

  const applications = problem.applications.map((application) => ({
    id: application.id,
    approach: application.approach,
    problemUnderstanding: application.problemUnderstanding,
    solutionDirection: application.solutionDirection,
    methodology: application.methodology,
    keySteps: application.keySteps,
    tools: application.tools,
    resources: application.resources,
    estimatedDuration: application.estimatedDuration,
    proposedBudget: application.proposedBudget,
    status: application.status,
    team: {
      name: application.team.name,
      university: application.team.university,
      description: application.team.description,
      experience: application.team.experience,
      relevantProducts: application.team.relevantProducts,
      achievements: application.team.achievements,
      interests: application.team.interests,
      ratingAverage: application.team.ratingAverage,
      ratingCount: application.team.ratingCount,
      skills: application.team.skills.map(({ skill }) => skill.name),
      members: application.team.memberships.map(({ name, major }) => ({ name, major })),
      projects: application.team.projects,
    },
  }));

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <Link
        className="text-sm font-semibold text-primary hover:underline"
        href={`/business/problems/${problem.id}`}
      >
        ← Chi tiết bài toán
      </Link>
      <p className="mt-4 text-sm font-semibold text-primary">{problem.field}</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">So sánh nhóm ứng tuyển</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{problem.title}</p>
      <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm leading-6">
        So sánh hồ sơ theo kỹ năng, chuyên môn, kinh nghiệm, Approach, Reputation,
        thời gian và chi phí. Việc chọn nhóm sẽ kết thúc nhận hồ sơ cho bài toán này.
      </div>
      <section className="mt-6">
        <ApplicationComparison
          applications={applications}
          problemId={problem.id}
          problemSkills={problem.skills.map(({ skill }) => skill.name)}
          problemStatus={problem.status}
        />
      </section>
    </main>
  );
}
