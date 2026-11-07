import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { ReputationSummary } from "@/components/reputation/reputation-summary";
import { ReviewList, TeamHistory } from "@/components/reputation/review-list";
import { ReportContentButton } from "@/components/reports/report-content-button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
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
        select: { id: true, title: true, description: true, demoUrl: true, field: true, fileName: true },
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

  const hasCapabilities =
    team.skills.length > 0 ||
    Boolean(team.experience) ||
    Boolean(team.achievements) ||
    Boolean(team.interests);

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 sm:py-10 lg:space-y-10">
      <header className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-muted/30 px-5 py-6 sm:px-8 sm:py-8">
          <p className="text-sm font-semibold text-primary">Hồ sơ nhóm</p>
          <p className="mt-3 text-sm font-medium text-muted-foreground">
            {team.university}
          </p>
          <h1 className="mt-2 break-words text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            {team.name}
          </h1>
          <Badge className="mt-4" variant="outline">
            Nhóm sinh viên
          </Badge>
        </div>
        <div className="px-5 py-6 sm:px-8 sm:py-7">
          <h2 className="text-base font-semibold">Giới thiệu</h2>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-muted-foreground sm:text-base">
            {team.description}
          </p>
          <div className="mt-5 border-t border-border pt-3">
            <ReportContentButton targetType="TEAM" targetId={team.id} />
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="team-members-heading">
          <Card className="h-full">
            <CardHeader>
              <h2
                className="text-xl font-semibold tracking-tight"
                id="team-members-heading"
              >
                Thành viên và chuyên môn
              </h2>
              <CardDescription>
                Các thành viên được giới thiệu trong hồ sơ nhóm.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {team.memberships.length === 0 ? (
                <EmptyState
                  className="bg-background px-4 py-8"
                  description="Hồ sơ hiện chưa có thông tin thành viên."
                  title="Chưa có thành viên"
                />
              ) : (
                <ul className="divide-y divide-border rounded-xl border border-border">
                  {team.memberships.map((member, index) => (
                    <li
                      className="flex min-w-0 flex-col gap-1 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                      key={`${member.name}-${index}`}
                    >
                      <span className="break-words font-semibold">
                        {member.name}
                      </span>
                      <span className="break-words text-sm text-muted-foreground sm:text-right">
                        {member.major}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>

        {hasCapabilities && (
          <section aria-labelledby="team-capabilities-heading">
            <Card className="h-full">
              <CardHeader>
                <h2
                  className="text-xl font-semibold tracking-tight"
                  id="team-capabilities-heading"
                >
                  Năng lực và kinh nghiệm
                </h2>
                <CardDescription>
                  Thông tin chuyên môn do nhóm cung cấp.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 pt-0">
                {team.skills.length > 0 && (
                  <section aria-labelledby="team-skills-heading">
                    <h3
                      className="text-sm font-semibold"
                      id="team-skills-heading"
                    >
                      Kỹ năng
                    </h3>
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {team.skills.map(({ skill }) => (
                        <li key={skill.name}>
                          <Badge variant="secondary">{skill.name}</Badge>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                {team.experience && (
                  <section aria-labelledby="team-experience-heading">
                    <h3
                      className="text-sm font-semibold"
                      id="team-experience-heading"
                    >
                      Kinh nghiệm
                    </h3>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
                      {team.experience}
                    </p>
                  </section>
                )}
                {team.achievements && (
                  <section aria-labelledby="team-achievements-heading">
                    <h3
                      className="text-sm font-semibold"
                      id="team-achievements-heading"
                    >
                      Thành tích hoặc chứng chỉ
                    </h3>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
                      {team.achievements}
                    </p>
                  </section>
                )}
                {team.interests && (
                  <section aria-labelledby="team-interests-heading">
                    <h3
                      className="text-sm font-semibold"
                      id="team-interests-heading"
                    >
                      Lĩnh vực quan tâm
                    </h3>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
                      {team.interests}
                    </p>
                  </section>
                )}
              </CardContent>
            </Card>
          </section>
        )}
      </div>

      <section aria-labelledby="team-portfolio-heading">
        <Card>
          <CardHeader>
            <h2
              className="text-xl font-semibold tracking-tight"
              id="team-portfolio-heading"
            >
              Portfolio
            </h2>
            <CardDescription>
              Sản phẩm nhóm đã chọn công khai trong hồ sơ.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {team.portfolioItems.length === 0 ? (
              <EmptyState
                className="bg-background px-4 py-10"
                description="Nhóm chưa công khai sản phẩm nào."
                title="Chưa có sản phẩm công khai"
              />
            ) : (
              <ul className="grid gap-4 md:grid-cols-2">
                {team.portfolioItems.map((item) => (
                  <li key={item.id}>
                    <article className="flex h-full min-w-0 flex-col rounded-2xl border border-border bg-background p-4 transition-colors hover:border-primary/40 motion-reduce:transition-none sm:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <h3 className="min-w-0 break-words text-lg font-semibold tracking-tight">
                          {item.title}
                        </h3>
                        {item.field && (
                          <Badge className="max-w-full whitespace-normal" variant="outline">
                            {item.field}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-3 flex-1 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
                        {item.description}
                      </p>
                      {(item.demoUrl || item.fileName) && (
                        <div className="mt-5 flex flex-col items-start gap-2 border-t border-border pt-4">
                          {item.demoUrl && (
                            <a
                              className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
                              href={item.demoUrl}
                              rel="noreferrer"
                              target="_blank"
                            >
                              Xem demo
                              <span className="sr-only">(mở trong tab mới)</span>
                            </a>
                          )}
                          {item.fileName && (
                            <a
                              className="inline-flex min-h-11 max-w-full items-center break-all rounded-lg px-2 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
                              href={`/api/teams/portfolio/${item.id}`}
                              rel="noreferrer"
                              target="_blank"
                            >
                              <span className="break-all">
                                Mở tệp: {item.fileName}
                              </span>
                              <span className="sr-only">(mở trong tab mới)</span>
                            </a>
                          )}
                        </div>
                      )}
                    </article>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section aria-label="Uy tín nhóm" className="space-y-5">
        <div>
          <p className="text-sm font-semibold text-primary">Đánh giá và uy tín</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight">
            Reputation và đánh giá
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Các chỉ số được tổng hợp từ dữ liệu đánh giá và hoạt động đủ điều
            kiện của nhóm.
          </p>
        </div>
        <ReputationSummary presentation="public" reputation={reputation} />
        <ReviewList
          basePath={`/teams/${team.id}`}
          presentation="public"
          reviewPage={reviewPage}
        />
      </section>

      <TeamHistory entries={history} presentation="public" />
    </main>
  );
}
