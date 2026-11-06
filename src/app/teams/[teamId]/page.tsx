import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { ReputationSummary } from "@/components/reputation/reputation-summary";
import { ReviewList, TeamHistory } from "@/components/reputation/review-list";
import { ReportContentButton } from "@/components/reports/report-content-button";
import { prisma } from "@/lib/prisma";
import {
  getTeamHistory,
  getTeamReputations,
  getTeamReviewPage,
} from "@/lib/reputation-data";

export const instant = false;

export default async function TeamProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/dang-nhap");
  const [{ teamId }, { page }] = await Promise.all([params, searchParams]);
  const team = await prisma.studentTeam.findFirst({
    where: { hiddenByAdmin: false, OR: [{ id: teamId }, { slug: teamId }] },
    select: {
      id: true,
      name: true,
      university: true,
      description: true,
      experience: true,
      achievements: true,
      interests: true,
      skills: { select: { skill: { select: { name: true } } } },
      memberships: {
        orderBy: [{ isLead: "desc" }, { joinedAt: "asc" }],
        select: { name: true, major: true },
      },
      portfolioItems: {
        where: { isVisible: true },
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, description: true, demoUrl: true, field: true },
      },
    },
  });
  if (!team) notFound();

  const requestedPage = Number(page ?? "1");
  const [reputations, reviewPage, history] = await Promise.all([
    getTeamReputations([team.id]),
    getTeamReviewPage(team.id, requestedPage),
    getTeamHistory(team.id),
  ]);
  const reputation = reputations.get(team.id);
  if (!reputation) throw new Error("Không thể tính Reputation cho nhóm.");

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <header className="rounded-2xl border border-border bg-card p-5 sm:p-7">
        <p className="text-sm font-semibold text-primary">{team.university}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{team.name}</h1>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{team.description}</p>
        {team.experience && (
          <p className="mt-4 whitespace-pre-wrap text-sm leading-6">
            <strong>Kinh nghiệm: </strong>{team.experience}
          </p>
        )}
        {team.achievements && (
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
            <strong>Thành tích: </strong>{team.achievements}
          </p>
        )}
        {team.interests && (
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
            <strong>Lĩnh vực quan tâm: </strong>{team.interests}
          </p>
        )}
        {team.skills.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {team.skills.map(({ skill }) => (
              <span className="rounded-full bg-muted px-3 py-1 text-xs" key={skill.name}>
                {skill.name}
              </span>
            ))}
          </div>
        )}
        <section className="mt-5">
          <h2 className="font-semibold">Thành viên</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {team.memberships.map((member, index) => (
              <li className="rounded-lg bg-muted/50 px-3 py-2 text-sm" key={`${member.name}-${index}`}>
                {member.name} — {member.major}
              </li>
            ))}
          </ul>
        </section>
        <ReportContentButton targetType="TEAM" targetId={team.id} />
      </header>
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-7">
        <h2 className="text-xl font-semibold">Portfolio</h2>
        {team.portfolioItems.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nhóm chưa công khai sản phẩm nào.</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {team.portfolioItems.map((item) => (
              <article className="rounded-xl border border-border p-4" key={item.id}>
                <h3 className="font-semibold">{item.title}</h3>
                {item.field && <p className="mt-1 text-xs text-primary">{item.field}</p>}
                <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
                {item.demoUrl && <a className="mt-3 inline-block text-sm text-primary hover:underline" href={item.demoUrl} rel="noreferrer" target="_blank">Xem demo</a>}
              </article>
            ))}
          </div>
        )}
      </section>
      <ReputationSummary reputation={reputation} />
      <ReviewList basePath={`/teams/${team.id}`} reviewPage={reviewPage} />
      <TeamHistory entries={history} />
    </main>
  );
}
