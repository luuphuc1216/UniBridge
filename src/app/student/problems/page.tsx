import Link from "next/link";
import { Prisma } from "@/generated/prisma/client";
import { ProblemResults } from "@/components/student/problem-results";
import {
  ProblemSearchForm,
  type ProblemSearchValues,
} from "@/components/student/problem-search-form";
import { requireStudent } from "@/lib/student-access";
import { prisma } from "@/lib/prisma";
import { getStudentDiscoverableProblemWhere } from "@/lib/problem-workflow";
import { getStudentRecommendations } from "@/lib/student-recommendations";

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
    problems.sort(
      (left, right) =>
        (recommendationData.scores[right.id] ?? 0) -
          (recommendationData.scores[left.id] ?? 0) ||
        right.createdAt.getTime() - left.createdAt.getTime(),
    );
  }
  const savedIds = new Set(savedRows.map(({ problemId }) => problemId));
  const sortParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && key !== "sort") sortParams.set(key, value);
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-primary">Khu vực sinh viên</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Bài toán doanh nghiệp</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tìm bài toán phù hợp với năng lực và mối quan tâm của nhóm.
          </p>
        </div>
        <Link
          className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-muted"
          href="/student/saved-problems"
        >
          Bài toán đã lưu
        </Link>
      </div>

      <ProblemSearchForm
        durations={durations.map(({ expectedDuration }) => expectedDuration)}
        fields={fields.map(({ field }) => field)}
        skills={skills.map(({ skill }) => skill.name)}
        values={values}
      />
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <span className="font-medium">Sắp xếp:</span>
        <Link
          className={sort === "newest" ? "font-semibold text-primary" : "text-muted-foreground"}
          href={`/student/problems?${new URLSearchParams(sortParams).toString()}`}
        >
          Mới nhất
        </Link>
        {recommendationData.hasTeam ? (
          <Link
            className={sort === "relevance" ? "font-semibold text-primary" : "text-muted-foreground"}
            href={`/student/problems?${new URLSearchParams([...sortParams, ["sort", "relevance"]]).toString()}`}
          >
            Phù hợp nhất
          </Link>
        ) : (
          <span className="text-muted-foreground" title="Hoàn thiện hồ sơ nhóm để dùng">
            Phù hợp nhất (hoàn thiện hồ sơ nhóm để dùng)
          </span>
        )}
      </div>
      <section className="mt-6">
        <ProblemResults
          problems={problems.map((problem) => ({
            ...problem,
              status: problem.status,
              saved: savedIds.has(problem.id),
              relevanceScore: recommendationData.hasTeam ? recommendationData.scores[problem.id] ?? 0 : undefined,
          }))}
        />
      </section>
    </main>
  );
}
