import { RecommendedProblems } from "@/components/student/recommended-problems";
import { requireStudent } from "@/lib/student-access";
import { getStudentRecommendations } from "@/lib/student-recommendations";

export const instant = false;

export default async function StudentDashboard() {
  const { userId } = await requireStudent();
  const { hasTeam, recommendations } = await getStudentRecommendations(userId);

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="text-sm font-semibold text-primary">Khu vực sinh viên</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Tổng quan</h1>
      <RecommendedProblems hasTeam={hasTeam} problems={recommendations} />
    </main>
  );
}
