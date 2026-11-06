import { RecommendedProblems } from "@/components/student/recommended-problems";
import { requireStudent } from "@/lib/student-access";
import { getStudentRecommendations } from "@/lib/student-recommendations";
import { prisma } from "@/lib/prisma";
import { getUnreadWorkspaceMessageCount } from "@/lib/workspace-messages";

export const instant = false;

export default async function StudentDashboard() {
  const { userId } = await requireStudent();
  const { hasTeam, recommendations } = await getStudentRecommendations(userId);
  const [unreadMessages, pendingApplications, selectedProjects] = await Promise.all([
    getUnreadWorkspaceMessageCount(userId, "STUDENT"),
    prisma.application.count({ where: { team: { OR: [{ ownerId: userId }, { memberships: { some: { studentProfile: { userId } } } }] }, status: "PENDING_CONFIRMATION" } }),
    prisma.project.count({ where: { team: { OR: [{ ownerId: userId }, { memberships: { some: { studentProfile: { userId } } } }] }, status: { in: ["AGREEING", "IN_PROGRESS"] } } }),
  ]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="text-sm font-semibold text-primary">Khu vực sinh viên</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Tổng quan</h1>
      <RecommendedProblems hasTeam={hasTeam} problems={recommendations} />
      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <Link className="rounded-2xl border border-border bg-card p-5 hover:border-primary" href="/student/applications">
          Hồ sơ đang chờ phản hồi: <strong>{pendingApplications}</strong>
        </Link>
        <Link className="rounded-2xl border border-border bg-card p-5 hover:border-primary" href="/student/projects">
          Dự án đang thực hiện: <strong>{selectedProjects}</strong>
        </Link>
        <Link className="rounded-2xl border border-border bg-card p-5 hover:border-primary" href="/student/messages">
          Tin nhắn chưa đọc: <strong>{unreadMessages}</strong>
        </Link>
      </section>
    </main>
  );
}
import Link from "next/link";
