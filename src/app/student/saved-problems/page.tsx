import Link from "next/link";
import { ProblemResults } from "@/components/student/problem-results";
import { requireStudent } from "@/lib/student-access";
import { prisma } from "@/lib/prisma";

export const instant = false;

export default async function SavedProblemsPage() {
  const { userId } = await requireStudent();
  const savedRows = await prisma.savedProblem.findMany({
    where: {
      userId,
      problem: {
        status: {
          in: ["APPROVED", "PUBLISHED", "TEAM_SELECTED", "PROTOTYPING", "EVALUATING"],
        },
      },
    },
    orderBy: { createdAt: "desc" },
    include: {
      problem: {
        include: {
          businessProfile: { select: { companyName: true } },
          skills: { include: { skill: { select: { name: true } } } },
        },
      },
    },
  });

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <Link
        className="text-sm font-semibold text-primary hover:underline"
        href="/student/problems"
      >
        ← Khám phá bài toán
      </Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">Bài toán đã lưu</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Danh sách bài toán bạn đã đánh dấu để xem lại.
      </p>
      <section className="mt-7">
        <ProblemResults
          problems={savedRows.map(({ problem }) => ({
            ...problem,
              status: problem.status,
              saved: true,
          }))}
        />
      </section>
    </main>
  );
}
