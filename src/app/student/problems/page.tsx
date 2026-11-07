import Link from "next/link";
import { Bookmark, ListFilter, Sparkles } from "lucide-react";
import { Prisma } from "@/generated/prisma/client";
import { ProblemResults } from "@/components/student/problem-results";
import {
  ProblemSearchForm,
  type ProblemSearchValues,
} from "@/components/student/problem-search-form";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireStudent } from "@/lib/student-access";
import { prisma } from "@/lib/prisma";
import { getStudentDiscoverableProblemWhere } from "@/lib/problem-workflow";
import { getStudentRecommendations } from "@/lib/student-recommendations";
import { sortByRecommendationScore } from "@/lib/recommendation-scoring";
import { cn } from "@/lib/utils";

export const instant = false;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function getParameter(
  params: Record<string, string | string[] | undefined>,
  name: string,
): string {
  const value = params[name];
  return typeof value === "string" ? value.trim().slice(0, 160) : "";
}

function parseAmount(value: string): number | null {
  if (!value) return null;
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount >= 0 && amount <= 2_147_483_647
    ? amount
    : null;
}

export default async function StudentProblemsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { userId } = await requireStudent();
  const params = await searchParams;
  const recommendationData = await getStudentRecommendations(userId);
  const sort = getParameter(params, "sort") || "newest";
  const values: ProblemSearchValues = {
    query: getParameter(params, "query"),
    field: getParameter(params, "field"),
    skill: getParameter(params, "skill"),
    duration: getParameter(params, "duration"),
    budgetMin: getParameter(params, "budgetMin"),
    budgetMax: getParameter(params, "budgetMax"),
  };
  const hasFilters = Object.values(values).some(Boolean);
  const budgetMin = parseAmount(values.budgetMin);
  const budgetMax = parseAmount(values.budgetMax);
  const filters: Prisma.ProblemWhereInput[] = [];

  if (values.query) {
    filters.push({
      OR: [
        { title: { contains: values.query } },
        { description: { contains: values.query } },
        { goal: { contains: values.query } },
      ],
    });
  }
  if (values.field) filters.push({ field: values.field });
  if (values.skill) {
    filters.push({
      skills: { some: { skill: { name: values.skill } } },
    });
  }
  if (values.duration) filters.push({ expectedDuration: values.duration });
  if (budgetMin !== null) {
    filters.push({ budgetMax: { gte: budgetMin } });
  }
  if (budgetMax !== null) {
    filters.push({ budgetMin: { lte: budgetMax } });
  }

  const studentProblemWhere = getStudentDiscoverableProblemWhere();
  const [problems, fields, durations, skills, savedRows] = await Promise.all([
    prisma.problem.findMany({
      where: { ...studentProblemWhere, AND: filters },
      orderBy: { approvedAt: "desc" },
      include: {
        businessProfile: { select: { companyName: true } },
        skills: { include: { skill: { select: { name: true } } } },
      },
    }),
    prisma.problem.findMany({
      where: studentProblemWhere,
      select: { field: true },
      distinct: ["field"],
      orderBy: { field: "asc" },
    }),
    prisma.problem.findMany({
      where: studentProblemWhere,
      select: { expectedDuration: true },
      distinct: ["expectedDuration"],
      orderBy: { expectedDuration: "asc" },
    }),
    prisma.problemSkill.findMany({
      where: { problem: studentProblemWhere },
      select: { skill: { select: { name: true } } },
      distinct: ["skillId"],
      orderBy: { skill: { name: "asc" } },
    }),
    prisma.savedProblem.findMany({
      where: { userId },
      select: { problemId: true },
    }),
  ]);
  if (sort === "relevance" && recommendationData.hasTeam) {
    problems.splice(0, problems.length, ...sortByRecommendationScore(problems, recommendationData.scores));
  }
  const savedIds = new Set(savedRows.map(({ problemId }) => problemId));
  const sortParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && key !== "sort") sortParams.set(key, value);
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <header className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">KHÁM PHÁ · KHU VỰC SINH VIÊN</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Bài toán doanh nghiệp</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Tìm bài toán phù hợp với năng lực và mối quan tâm của nhóm.
          </p>
        </div>
        <Link
          className={cn(buttonVariants({ variant: "outline" }), "w-full sm:w-auto")}
          href="/student/saved-problems"
        >
          <Bookmark aria-hidden="true" className="h-4 w-4" />
          Bài toán đã lưu
        </Link>
      </header>

      <section aria-labelledby="problem-filters-title" className="mt-6">
        <div className="mb-3 flex items-center gap-2">
          <ListFilter aria-hidden="true" className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold" id="problem-filters-title">Tìm và lọc bài toán</h2>
        </div>
        <ProblemSearchForm
          durations={durations.map(({ expectedDuration }) => expectedDuration)}
          fields={fields.map(({ field }) => field)}
          skills={skills.map(({ skill }) => skill.name)}
          values={values}
        />
      </section>
      <section aria-label="Sắp xếp bài toán" className="mt-6 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm font-medium">Sắp xếp:</span>
        <Link
          aria-current={sort === "newest" ? "page" : undefined}
          className={cn(
            buttonVariants({ variant: sort === "newest" ? "secondary" : "ghost", size: "sm" }),
            "rounded-full motion-reduce:transition-none",
          )}
          href={`/student/problems?${new URLSearchParams(sortParams).toString()}`}
        >
          Mới nhất
        </Link>
        {recommendationData.hasTeam ? (
          <Link
            aria-current={sort === "relevance" ? "page" : undefined}
            className={cn(
              buttonVariants({ variant: sort === "relevance" ? "secondary" : "ghost", size: "sm" }),
              "rounded-full motion-reduce:transition-none",
            )}
            href={`/student/problems?${new URLSearchParams([...sortParams, ["sort", "relevance"]]).toString()}`}
          >
            <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
            Phù hợp nhất
          </Link>
        ) : (
          <Badge className="text-muted-foreground" title="Hoàn thiện hồ sơ nhóm để dùng" variant="outline">
            Phù hợp nhất · Hoàn thiện hồ sơ nhóm để dùng
          </Badge>
        )}
      </section>
      <section aria-label="Danh sách bài toán" className="mt-4">
        {problems.length === 0 ? (
          <EmptyState
            action={hasFilters ? (
              <Link
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "motion-reduce:transition-none",
                )}
                href="/student/problems"
              >
                Xóa bộ lọc
              </Link>
            ) : undefined}
            className="py-12"
            description={
              hasFilters
                ? "Hãy điều chỉnh từ khóa hoặc bộ lọc để xem thêm bài toán."
                : "Hiện chưa có bài toán nào được công khai. Bạn có thể quay lại sau."
            }
            icon={<Bookmark aria-hidden="true" className="h-5 w-5" />}
            title={hasFilters ? "Chưa tìm thấy kết quả" : "Chưa có bài toán"}
          />
        ) : (
          <ProblemResults
            problems={problems.map((problem) => ({
            ...problem,
            status: problem.status,
            saved: savedIds.has(problem.id),
            relevanceScore: recommendationData.hasTeam ? recommendationData.scores[problem.id] ?? 0 : undefined,
            }))}
          />
        )}
      </section>
    </main>
  );
}
