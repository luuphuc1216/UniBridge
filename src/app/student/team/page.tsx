import { requireStudent } from "@/lib/student-access";
import { prisma } from "@/lib/prisma";
import { getOwnedTeam } from "@/lib/student-team";
import { TeamProfileForm } from "@/components/student/team-profile-form";
import { ReputationSummary } from "@/components/reputation/reputation-summary";
import { ReviewList, TeamHistory } from "@/components/reputation/review-list";
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
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <p className="text-sm font-semibold text-primary">Khu vực sinh viên</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Hồ sơ nhóm</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Hoàn thiện hồ sơ để doanh nghiệp hiểu rõ năng lực và kinh nghiệm của nhóm.
      </p>
      <section className="mt-7 rounded-2xl border border-border bg-card p-5 sm:p-7">
        <TeamProfileForm team={team} />
      </section>
      {team && (
        <section className="mt-6 rounded-2xl border border-border bg-card p-5 sm:p-7">
          <h2 className="text-xl font-semibold">Portfolio nhóm</h2>
          <form action={savePortfolioItem} className="mt-4 grid gap-3 sm:grid-cols-2">
            <input name="teamId" type="hidden" value={team.id} />
            <input className="rounded-xl border border-border bg-background px-3 py-2" name="title" placeholder="Tên sản phẩm" required />
            <input className="rounded-xl border border-border bg-background px-3 py-2" name="field" placeholder="Lĩnh vực" />
            <input className="rounded-xl border border-border bg-background px-3 py-2" name="demoUrl" placeholder="Liên kết demo" type="url" />
            <input className="rounded-xl border border-border bg-background px-3 py-2" name="file" type="file" accept="image/png,image/jpeg,application/pdf" />
            <textarea className="rounded-xl border border-border bg-background p-3 sm:col-span-2" name="description" placeholder="Mô tả ngắn" required />
            <button className="w-fit rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground" type="submit">Thêm vào Portfolio</button>
          </form>
          <div className="mt-6 grid gap-3">
            {team.portfolioItems?.map((item) => (
              <div className="rounded-xl border border-border p-4" key={item.id}>
                <form action={updatePortfolioItem} className="grid gap-2">
                  <input name="id" type="hidden" value={item.id} />
                  <input className="rounded-lg border border-border bg-background px-3 py-2 text-sm" defaultValue={item.title} name="title" required />
                  <textarea className="rounded-lg border border-border bg-background p-2 text-sm" defaultValue={item.description} name="description" required />
                  <input className="rounded-lg border border-border bg-background px-3 py-2 text-sm" defaultValue={item.field} name="field" placeholder="Lĩnh vực" />
                  <input className="rounded-lg border border-border bg-background px-3 py-2 text-sm" defaultValue={item.demoUrl ?? ""} name="demoUrl" placeholder="Liên kết demo" type="url" />
                  <input className="rounded-lg border border-border bg-background px-3 py-2 text-sm" name="file" type="file" accept="image/png,image/jpeg,application/pdf" />
                  <div className="flex flex-wrap gap-3">
                    <button className="text-sm font-semibold text-primary" type="submit">Lưu</button>
                    <button className="text-sm text-primary" formAction={togglePortfolioItem} type="submit">{item.isVisible ? "Ẩn" : "Hiện"}</button>
                    <button className="text-sm text-destructive" formAction={deletePortfolioItem} type="submit">Xóa</button>
                  </div>
                </form>
              </div>
            ))}
          </div>
          {completedProjects.length > 0 && (
            <div className="mt-6 border-t border-border pt-5">
              <h3 className="font-semibold">Dự án đã hoàn tất</h3>
              {completedProjects.map((project) => (
                <form action={addCompletedProjectToPortfolio} className="mt-2 flex items-center justify-between gap-3 text-sm" key={project.id}>
                  <span>{project.title}</span>
                  <input name="projectId" type="hidden" value={project.id} />
                  <button className="text-primary hover:underline" type="submit">Thêm vào Portfolio</button>
                </form>
              ))}
            </div>
          )}
        </section>
      )}
      {team && reviewPage && reputation && (
        <div className="mt-6 space-y-6">
          <ReputationSummary reputation={reputation} />
          <ReviewList basePath="/student/team" reviewPage={reviewPage} />
          <TeamHistory entries={history} />
        </div>
      )}
    </main>
  );
}
