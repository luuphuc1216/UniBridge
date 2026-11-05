import Link from "next/link";
import { notFound } from "next/navigation";
import { ApplicationForm } from "@/components/student/application-form";
import { ApplicationWithdrawButton } from "@/components/student/application-withdraw-button";
import { InvitationResponse } from "@/components/student/invitation-response";
import { SavedProblemButton } from "@/components/student/saved-problem-button";
import { ReportContentButton } from "@/components/reports/report-content-button";
import { requireStudent } from "@/lib/student-access";
import { getOwnedTeam, getTeamForUser } from "@/lib/student-team";
import { prisma } from "@/lib/prisma";
import { expireInvitations } from "@/jobs/expire-invitations";
import { canRespondToInvitation } from "@/lib/application-status";
import {
  getApplicationUnavailableReason,
  isProblemAcceptingApplications,
  STUDENT_DISCOVERABLE_PROBLEM_STATUSES,
} from "@/lib/problem-workflow";
import { getPrototypeProblemStatusLabel } from "@/lib/prototype-status";

export const instant = false;

const workspaceStatusLabels: Record<string, string> = {
  REJECTED: "Bị từ chối",
  PENDING_CONFIRMATION: "Đang chờ xác nhận hợp tác",
  DECLINED: "Đã từ chối lời mời",
  EXPIRED: "Lời mời đã hết hạn",
  NOT_SELECTED: "Không được chọn",
  TEAM_SELECTED: "Đã chọn nhóm",
  PROTOTYPING: "Đang xây dựng Bản thử nghiệm (Prototype) / Đề xuất giải pháp",
  EVALUATING: "Đang được doanh nghiệp đánh giá",
  CLOSED: "Đã kết thúc – không triển khai",
  READY_FOR_IMPLEMENTATION: "Sẵn sàng soạn thỏa thuận triển khai",
};

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
  await expireInvitations();
  const problem = await prisma.problem.findFirst({
    where: {
      id: problemId,
      OR: [
        {
          hiddenByAdmin: false,
          status: { in: [...STUDENT_DISCOVERABLE_PROBLEM_STATUSES, "REJECTED"] },
        },
        {
          status: { in: ["CLOSED", "READY_FOR_IMPLEMENTATION"] },
          applications: {
            some: {
              status: "SELECTED",
              team: {
                OR: [
                  { ownerId: userId },
                  { memberships: { some: { studentProfile: { userId } } } },
                ],
              },
            },
          },
        },
      ],
    },
    include: {
      businessProfile: { select: { companyName: true, industry: true } },
      attachments: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!problem) {
    notFound();
  }
  const canAcceptApplications = isProblemAcceptingApplications(problem.status);

  const [ownedTeam, team] = await Promise.all([
    getOwnedTeam(userId),
    getTeamForUser(userId),
  ]);
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
            invitations: {
              where: { status: "PENDING_CONFIRMATION" },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { expiresAt: true, status: true },
            },
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
      {!problem.hiddenByAdmin && (
        <ReportContentButton targetType="PROBLEM" targetId={problem.id} />
      )}
      {workspaceStatusLabels[problem.status] && (
        <span className="mt-3 inline-flex rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
          {getPrototypeProblemStatusLabel(problem)}
        </span>
      )}
      {!["REJECTED", "CLOSED", "READY_FOR_IMPLEMENTATION"].includes(problem.status) && (
        <div className="mt-4">
          <SavedProblemButton
            isSaved={Boolean(savedProblem)}
            problemId={problem.id}
          />
        </div>
      )}
      {application?.status === "SELECTED" &&
        ["TEAM_SELECTED", "PROTOTYPING", "EVALUATING", "CLOSED", "READY_FOR_IMPLEMENTATION"].includes(
          problem.status,
        ) && (
          <Link
            className="mt-4 inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
            href={`/student/workspace/${problem.id}?applicationId=${application.id}`}
          >
            Mở không gian làm việc của nhóm
          </Link>
        )}

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
        <h2 className="text-xl font-semibold" id="application-response">Hồ sơ ứng tuyển</h2>
        {!canAcceptApplications ? (
          <div className="mt-3 space-y-3">
            <button
              aria-describedby="application-unavailable-reason"
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground opacity-60 sm:w-auto"
              disabled
              type="button"
            >
              Gửi Profile + Approach
            </button>
            <p
              className="rounded-xl bg-muted p-4 text-sm leading-6 text-muted-foreground"
              id="application-unavailable-reason"
            >
              {getApplicationUnavailableReason(problem.status, problem.reviewNote)}
            </p>
          </div>
        ) : !team ? (
          <div className="mt-3 rounded-xl bg-muted p-4 text-sm leading-6">
            Bạn cần hoàn thiện hồ sơ nhóm trước khi gửi hồ sơ ứng tuyển.{" "}
            <Link className="font-semibold text-primary hover:underline" href="/student/team">
              Tạo hồ sơ nhóm
            </Link>
          </div>
        ) : application?.status === "PENDING_CONFIRMATION" && application.invitations[0] ? (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <h3 className="font-semibold text-amber-900">Doanh nghiệp mời hợp tác</h3>
            <p className="mt-2 text-sm text-amber-800">
              {problem.businessProfile.companyName} đã mời nhóm tham gia bài toán này.
            </p>
            <InvitationResponse
              applicationId={application.id}
              canRespond={canRespondToInvitation(application.status, Boolean(ownedTeam))}
              expiresAt={application.invitations[0].expiresAt}
              problemId={problem.id}
            />
          </div>
        ) : application && (!ownedTeam || !["SUBMITTED", "WITHDRAWN"].includes(application.status)) ? (
          <p className="mt-3 rounded-xl bg-muted p-4 text-sm leading-6">
            {!ownedTeam
              ? "Chỉ trưởng nhóm mới có thể chỉnh sửa hoặc phản hồi hồ sơ này."
              : application.status === "SELECTED"
              ? "Doanh nghiệp đã chọn nhóm cho bài toán này."
              : application.status === "DECLINED"
                ? "Bạn đã từ chối lời mời hợp tác."
                : application.status === "EXPIRED"
                  ? "Lời mời hợp tác đã hết hạn."
                  : application.status === "NOT_SELECTED" || application.status === "REJECTED"
                    ? "Hồ sơ không được chọn."
                    : "Hồ sơ này hiện không có thao tác khả dụng."}
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
