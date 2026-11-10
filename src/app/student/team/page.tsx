import { requireStudent } from "@/lib/student-access";
import { prisma } from "@/lib/prisma";
import { getOwnedTeam } from "@/lib/student-team";
import { TeamProfileForm } from "@/components/student/team-profile-form";
import { DirectUploadField } from "@/components/uploads/direct-upload-field";
import { ReputationSummary } from "@/components/reputation/reputation-summary";
import { ReviewList, TeamHistory } from "@/components/reputation/review-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  getTeamHistory,
  getTeamReputations,
  getTeamReviewPage,
} from "@/lib/reputation-data";
import type { TeamReputation } from "@/lib/reputation";
import type { ReviewPage, TeamHistoryEntry } from "@/lib/reputation-data";
import {
  addCompletedProjectToPortfolio,
  deletePortfolioItem,
  savePortfolioItem,
  togglePortfolioItem,
  updatePortfolioItem,
} from "./portfolio-actions";

export const instant = false;

export default async function StudentTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { userId } = await requireStudent();
  const team = await getOwnedTeam(userId);
  const { page } = await searchParams;
  let reputation: TeamReputation | null = null;
  let reviewPage: ReviewPage | null = null;
  let history: TeamHistoryEntry[] = [];
  if (team) {
    const requestedPage = Number(page ?? "1");
    const [reputations, loadedReviews, loadedHistory] = await Promise.all([
      getTeamReputations([team.id]),
      getTeamReviewPage(team.id, requestedPage),
      getTeamHistory(team.id),
    ]);
    reputation = reputations.get(team.id) ?? null;
    reviewPage = loadedReviews;
    history = loadedHistory;
  }
  const completedProjects = team
    ? await prisma.project.findMany({
        where: { teamId: team.id, status: "COMPLETED", portfolioItem: null },
        select: { id: true, title: true },
      })
    : [];

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 sm:py-10 lg:space-y-10">
      <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">Khu vực sinh viên</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Hồ sơ nhóm
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Giới thiệu năng lực và kinh nghiệm của nhóm để doanh nghiệp hiểu rõ
            hơn về những gì nhóm có thể thực hiện.
          </p>
        </div>
        <Badge
          className="w-fit"
          variant={team ? "success" : "secondary"}
        >
          {team ? "Đã tạo hồ sơ" : "Chưa tạo hồ sơ"}
        </Badge>
      </header>

      {team ? (
        <section aria-label="Tổng quan hồ sơ nhóm">
          <Card className="overflow-hidden">
            <CardHeader className="gap-3 border-b border-border bg-muted/30 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold tracking-tight">
                  {team.name}
                </h2>
                <CardDescription className="text-sm font-medium">
                  {team.university}
                </CardDescription>
              </div>
              <Badge className="w-fit" variant="outline">
                Hồ sơ nhóm
              </Badge>
            </CardHeader>
            <CardContent className="space-y-5 p-5 sm:p-6">
              <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground sm:text-base">
                {team.description}
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <section aria-labelledby="team-members-heading" className="rounded-xl bg-muted/50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold" id="team-members-heading">
                      Thành viên
                    </h3>
                    <Badge variant="secondary">
                      {team.memberships.length}
                    </Badge>
                  </div>
                  {team.memberships.length === 0 ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      Chưa có thành viên trong hồ sơ.
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {team.memberships.map((member, index) => (
                        <li
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2"
                          key={`${member.name}-${member.major}-${index}`}
                        >
                          <div>
                            <p className="text-sm font-medium">{member.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {member.major}
                            </p>
                          </div>
                          <Badge variant={member.isLead ? "default" : "outline"}>
                            {member.title}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <section aria-labelledby="team-skills-heading" className="rounded-xl bg-muted/50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold" id="team-skills-heading">
                      Kỹ năng
                    </h3>
                    <Badge variant="secondary">{team.skills.length}</Badge>
                  </div>
                  {team.skills.length === 0 ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      Chưa có kỹ năng được thêm vào hồ sơ.
                    </p>
                  ) : (
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {team.skills.map(({ skill }) => (
                        <li key={skill.name}>
                          <Badge variant="outline">{skill.name}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            </CardContent>
          </Card>
        </section>
      ) : (
        <EmptyState
          className="bg-card"
          description="Tạo hồ sơ để giới thiệu nhóm với doanh nghiệp. Bạn có thể bắt đầu bằng biểu mẫu bên dưới."
          title="Bạn chưa có hồ sơ nhóm"
        />
      )}

      <section aria-labelledby="team-profile-form-heading">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold leading-none tracking-tight" id="team-profile-form-heading">
              {team ? "Thông tin hồ sơ nhóm" : "Tạo hồ sơ nhóm"}
            </h2>
            <CardDescription>
              Cập nhật thông tin giới thiệu và năng lực của nhóm.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <TeamProfileForm team={team} />
          </CardContent>
        </Card>
      </section>

      {team && (
        <section aria-labelledby="portfolio-heading">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold leading-none tracking-tight" id="portfolio-heading">
                Portfolio nhóm
              </h2>
              <CardDescription>
                Quản lý sản phẩm và dự án nhóm muốn giới thiệu.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <form action={savePortfolioItem} className="space-y-5 rounded-xl border border-border bg-muted/30 p-4 sm:p-5">
                <input name="teamId" type="hidden" value={team.id} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-medium">
                    Tên sản phẩm
                    <Input
                      className="text-base motion-reduce:transition-none sm:text-sm"
                      name="title"
                      placeholder="Tên sản phẩm"
                      required
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    Lĩnh vực
                    <Input
                      className="text-base motion-reduce:transition-none sm:text-sm"
                      name="field"
                      placeholder="Lĩnh vực"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium sm:col-span-2">
                    Liên kết demo
                    <Input
                      className="text-base motion-reduce:transition-none sm:text-sm"
                      name="demoUrl"
                      placeholder="Liên kết demo"
                      type="url"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium sm:col-span-2">
                    Tệp minh họa
                    <DirectUploadField
                      accept="image/png,image/jpeg,application/pdf"
                      className="h-auto min-h-11 py-2 text-base motion-reduce:transition-none sm:text-sm"
                      name="file"
                      scope={{ kind: "portfolio", teamId: team.id }}
                    />
                    <span className="text-xs font-normal text-muted-foreground">
                      Tệp PNG, JPG hoặc PDF.
                    </span>
                  </label>
                  <label className="grid gap-2 text-sm font-medium sm:col-span-2">
                    Mô tả ngắn
                    <Textarea
                      className="text-base motion-reduce:transition-none sm:text-sm"
                      name="description"
                      placeholder="Mô tả ngắn"
                      required
                    />
                  </label>
                </div>
                <Button
                  className="w-full motion-reduce:transition-none sm:w-auto"
                  type="submit"
                >
                  Thêm vào Portfolio
                </Button>
              </form>

              <section aria-label="Danh sách Portfolio" className="space-y-4">
                {team.portfolioItems.length === 0 ? (
                  <EmptyState
                    className="bg-background px-4 py-8"
                    description="Các sản phẩm được thêm vào sẽ xuất hiện tại đây. Chưa có sản phẩm nào được tạo."
                    title="Portfolio đang trống"
                  />
                ) : (
                  <div className="grid gap-4 xl:grid-cols-2">
                    {team.portfolioItems.map((item) => (
                      <article
                        className="rounded-xl border border-border bg-background p-4 sm:p-5"
                        key={item.id}
                      >
                        <form action={updatePortfolioItem} className="space-y-4">
                          <input name="id" type="hidden" value={item.id} />
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="text-sm font-semibold">
                              Thông tin sản phẩm
                            </h3>
                            <Badge variant={item.isVisible ? "success" : "secondary"}>
                              {item.isVisible ? "Đang công khai" : "Đang ẩn"}
                            </Badge>
                          </div>
                          <div className="grid gap-4">
                            <label className="grid gap-2 text-sm font-medium">
                              Tên sản phẩm
                              <Input
                                className="text-base motion-reduce:transition-none sm:text-sm"
                                defaultValue={item.title}
                                name="title"
                                required
                              />
                            </label>
                            <label className="grid gap-2 text-sm font-medium">
                              Mô tả
                              <Textarea
                                className="text-base motion-reduce:transition-none sm:text-sm"
                                defaultValue={item.description}
                                name="description"
                                required
                              />
                            </label>
                            <label className="grid gap-2 text-sm font-medium">
                              Lĩnh vực
                              <Input
                                className="text-base motion-reduce:transition-none sm:text-sm"
                                defaultValue={item.field}
                                name="field"
                                placeholder="Lĩnh vực"
                              />
                            </label>
                            <label className="grid gap-2 text-sm font-medium">
                              Liên kết demo
                              <Input
                                className="text-base motion-reduce:transition-none sm:text-sm"
                                defaultValue={item.demoUrl ?? ""}
                                name="demoUrl"
                                placeholder="Liên kết demo"
                                type="url"
                              />
                            </label>
                            <label className="grid gap-2 text-sm font-medium">
                              Tệp minh họa
                              <DirectUploadField
                                accept="image/png,image/jpeg,application/pdf"
                                className="h-auto min-h-11 py-2 text-base motion-reduce:transition-none sm:text-sm"
                                name="file"
                                scope={{
                                  kind: "portfolio",
                                  teamId: team.id,
                                  itemId: item.id,
                                }}
                              />
                              <span className="text-xs font-normal text-muted-foreground">
                                Tệp PNG, JPG hoặc PDF.
                              </span>
                            </label>
                          </div>
                          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                            <Button
                              className="min-w-20 motion-reduce:transition-none"
                              type="submit"
                              variant="outline"
                            >
                              Lưu
                            </Button>
                            <Button
                              className="min-w-20 motion-reduce:transition-none"
                              formAction={togglePortfolioItem}
                              type="submit"
                              variant="secondary"
                            >
                              {item.isVisible ? "Ẩn" : "Hiện"}
                            </Button>
                            <Button
                              className="min-w-20 motion-reduce:transition-none"
                              formAction={deletePortfolioItem}
                              type="submit"
                              variant="destructive"
                            >
                              Xóa
                            </Button>
                          </div>
                        </form>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section aria-labelledby="completed-projects-heading" className="border-t border-border pt-6">
                <div className="mb-4">
                  <h3 className="font-semibold" id="completed-projects-heading">
                    Dự án đã hoàn tất
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Thêm dự án đã hoàn tất vào Portfolio của nhóm.
                  </p>
                </div>
                {completedProjects.length === 0 ? (
                  <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
                    Hiện không có dự án hoàn tất nào cần thêm vào Portfolio.
                  </p>
                ) : (
                  <ul className="divide-y divide-border rounded-xl border border-border">
                    {completedProjects.map((project) => (
                      <li
                        className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                        key={project.id}
                      >
                        <span className="text-sm font-medium">{project.title}</span>
                        <form action={addCompletedProjectToPortfolio}>
                          <input
                            name="projectId"
                            type="hidden"
                            value={project.id}
                          />
                          <Button
                            className="w-full motion-reduce:transition-none sm:w-auto"
                            type="submit"
                            variant="outline"
                          >
                            Thêm vào Portfolio
                          </Button>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </CardContent>
          </Card>
        </section>
      )}

      {team && reviewPage && reputation && (
        <section aria-label="Uy tín và hoạt động" className="space-y-5">
          <div className="space-y-6">
            <ReputationSummary reputation={reputation} />
            <ReviewList basePath="/student/team" reviewPage={reviewPage} />
            <TeamHistory entries={history} />
          </div>
        </section>
      )}
    </main>
  );
}
