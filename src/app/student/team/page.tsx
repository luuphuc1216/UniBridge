import { requireStudent } from "@/lib/student-access";
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
