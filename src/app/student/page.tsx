import { RecommendedProblems } from "@/components/student/recommended-problems";
import { requireStudent } from "@/lib/student-access";
import { getStudentRecommendations } from "@/lib/student-recommendations";

export const instant = false;

export default async function StudentDashboard() {
  const { userId } = await requireStudent();
  const { hasTeam, recommendations } = await getStudentRecommendations(userId);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-[2rem] bg-brand-navy p-6 text-white sm:p-8">
        <p className="text-sm font-semibold text-brand-light">Khu vực sinh viên</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Tổng quan</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
          Khám phá bài toán phù hợp với năng lực nhóm và theo dõi các cơ hội hợp tác của bạn.
        </p>
      </section>
      <RecommendedProblems hasTeam={hasTeam} problems={recommendations} />
    </main>
  );
}
