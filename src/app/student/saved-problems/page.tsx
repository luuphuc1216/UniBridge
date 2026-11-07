import Link from "next/link";
import { BookmarkX } from "lucide-react";
import { ProblemResults } from "@/components/student/problem-results";
import { SavedProblemsFeedbackProvider } from "@/components/student/saved-problem-button";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireStudent } from "@/lib/student-access";
import { prisma } from "@/lib/prisma";
import { getStudentDiscoverableProblemWhere } from "@/lib/problem-workflow";
import { cn } from "@/lib/utils";

export const instant = false;

export default async function SavedProblemsPage() {
  const { userId } = await requireStudent();
  const savedRows = await prisma.savedProblem.findMany({
    where: {
      userId,
      problem: getStudentDiscoverableProblemWhere(),
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
      <SavedProblemsFeedbackProvider>
        <header className="border-b border-border pb-6">
          <Link
            className="text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href="/student/problems"
          >
            ← Khám phá bài toán
          </Link>
          <p className="mt-5 text-sm font-semibold text-primary">THƯ VIỆN CỦA BẠN</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Bài toán đã lưu</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Danh sách bài toán bạn đã đánh dấu để xem lại.
          </p>
        </header>
        <section aria-label="Danh sách bài toán đã lưu" className="mt-6">
          {savedRows.length === 0 ? (
            <EmptyState
              action={(
                <Link
                  className={cn(
                    buttonVariants(),
                    "w-full motion-reduce:transition-none sm:w-auto",
                  )}
                  href="/student/problems"
                >
                  Khám phá bài toán
                </Link>
              )}
              className="py-12"
              description="Những bài toán bạn lưu sẽ xuất hiện tại đây để tiện xem lại."
              icon={<BookmarkX aria-hidden="true" className="h-5 w-5" />}
              title="Chưa có bài toán nào được lưu"
            />
          ) : (
            <ProblemResults
              problems={savedRows.map(({ problem }) => ({
                ...problem,
                status: problem.status,
                saved: true,
              }))}
            />
          )}
        </section>
      </SavedProblemsFeedbackProvider>
    </main>
  );
}
