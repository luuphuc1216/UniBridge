import Link from "next/link";
import { notFound } from "next/navigation";
import { ApplicationForm } from "@/components/student/application-form";
import { ApplicationWithdrawButton } from "@/components/student/application-withdraw-button";
import { SavedProblemButton } from "@/components/student/saved-problem-button";
import { requireStudent } from "@/lib/student-access";
import { getOwnedTeam } from "@/lib/student-team";
import { prisma } from "@/lib/prisma";

export const instant = false;

function formatCurrency(amount: number | null): string {
  return amount === null
    ? "Chưa xác định"
    : new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0,
      }).format(amount);
}

export default async function StudentProblemDetailPage({
  params,
}: {
  params: Promise<{ problemId: string }>;
}) {
  const { userId } = await requireStudent();
  const { problemId } = await params;
  const problem = await prisma.problem.findFirst({
    where: {
      id: problemId,
      status: { in: ["APPROVED", "PUBLISHED", "TEAM_SELECTED"] },
    },
    include: {
      businessProfile: { select: { companyName: true, industry: true } },
      attachments: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!problem) {
    notFound();
  }

  const team = await getOwnedTeam(userId);
  const [savedProblem, application] = await Promise.all([
    prisma.savedProblem.findUnique({
      where: { userId_problemId: { userId, problemId } },
      select: { problemId: true },
    }),
    team
      ? prisma.application.findUnique({
          where: { problemId_teamId: { problemId, teamId: team.id } },
          select: {
            id: true,
            status: true,
            problemUnderstanding: true,
            solutionDirection: true,
            methodology: true,
            keySteps: true,
            tools: true,
            resources: true,
            estimatedDuration: true,
            proposedBudget: true,
          },
        })
      : Promise.resolve(null),
  ]);
  await prisma.viewLog.create({ data: { userId, problemId } });

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <Link
        className="text-sm font-semibold text-primary hover:underline"
        href="/student/problems"
      >
        ← Danh sách bài toán
      </Link>
      <p className="mt-4 text-sm font-semibold text-primary">{problem.field}</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">{problem.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {problem.businessProfile.companyName} · {problem.businessProfile.industry}
      </p>
      <div className="mt-4">
        <SavedProblemButton
          isSaved={Boolean(savedProblem)}
          problemId={problem.id}
        />
      </div>

      <div className="mt-8 grid gap-5">
        <section className="rounded-2xl border border-border bg-card p-5 sm:p-7">
          <h2 className="text-lg font-semibold">Mô tả vấn đề</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
            {problem.description}
          </p>
        </section>
        <section className="grid gap-5 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-7">
            <h2 className="font-semibold">Mục tiêu</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
              {problem.goal}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-7">
            <h2 className="font-semibold">Yêu cầu đối với nhóm sinh viên</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
              {problem.requirements}
            </p>
          </div>
        </section>
        <section className="grid gap-5 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-7">
            <h2 className="font-semibold">Thời gian dự kiến</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {problem.expectedDuration}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-7">
            <h2 className="font-semibold">Ngân sách tham khảo</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {formatCurrency(problem.budgetMin)} – {formatCurrency(problem.budgetMax)}
            </p>
          </div>
        </section>
        <section className="rounded-2xl border border-border bg-card p-5 sm:p-7">
          <h2 className="font-semibold">Tài liệu liên quan</h2>
          {problem.attachments.length > 0 ? (
            <ul className="mt-3 divide-y divide-border">
              {problem.attachments.map((attachment) => (
                <li className="py-3 first:pt-0 last:pb-0" key={attachment.id}>
                  <a
                    className="break-all text-sm font-medium text-primary hover:underline"
                    href={`/api/business/attachments/${attachment.id}`}
                  >
                    {attachment.originalName}
                  </a>
                  <span className="ml-2 text-sm text-muted-foreground">
                    ({(attachment.sizeBytes / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Chưa có tài liệu đính kèm.</p>
          )}
        </section>
      </div>

      <section className="mt-7 rounded-2xl border border-border bg-card p-5 sm:p-7">
        <h2 className="text-xl font-semibold">Hồ sơ ứng tuyển</h2>
        {problem.status !== "APPROVED" ? (
          <p className="mt-3 rounded-xl bg-muted p-4 text-sm leading-6 text-muted-foreground">
            Bài toán hiện không nhận hồ sơ mới. Bạn vẫn có thể xem thông tin và hồ sơ đã gửi.
          </p>
        ) : !team ? (
          <div className="mt-3 rounded-xl bg-muted p-4 text-sm leading-6">
            Bạn cần hoàn thiện hồ sơ nhóm trước khi gửi hồ sơ ứng tuyển.{" "}
            <Link className="font-semibold text-primary hover:underline" href="/student/team">
              Tạo hồ sơ nhóm
            </Link>
          </div>
        ) : application && !["SUBMITTED", "WITHDRAWN"].includes(application.status) ? (
          <p className="mt-3 rounded-xl bg-muted p-4 text-sm leading-6">
            {application.status === "SELECTED"
              ? "Doanh nghiệp đã chọn nhóm cho bài toán này."
              : "Doanh nghiệp đã xử lý hồ sơ này; bạn không thể chỉnh sửa hoặc rút."}
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Trình bày năng lực nhóm và cách tiếp cận. Chưa cần nộp Prototype.
            </p>
            <ApplicationForm
              application={
                application
                  ? {
                      problemUnderstanding: application.problemUnderstanding,
                      solutionDirection: application.solutionDirection,
                      methodology: application.methodology,
                      keySteps: application.keySteps,
                      tools: application.tools,
                      resources: application.resources,
                      estimatedDuration: application.estimatedDuration,
                      proposedBudget: application.proposedBudget,
                    }
                  : null
              }
              isResubmission={application?.status === "WITHDRAWN"}
              problemId={problem.id}
            />
            {application?.status === "SUBMITTED" && (
              <ApplicationWithdrawButton problemId={problem.id} />
            )}
          </>
        )}
      </section>
    </main>
  );
}
