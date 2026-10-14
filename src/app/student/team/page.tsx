import { requireStudent } from "@/lib/student-access";
import { getOwnedTeam } from "@/lib/student-team";
import { TeamProfileForm } from "@/components/student/team-profile-form";

export const instant = false;

export default async function StudentTeamPage() {
  const { userId } = await requireStudent();
  const team = await getOwnedTeam(userId);

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
    </main>
  );
}
