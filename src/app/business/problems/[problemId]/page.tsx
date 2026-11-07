import Link from "next/link";
import { notFound } from "next/navigation";
import { activeApplicationsWhere } from "@/lib/applications";
import { requireBusinessProfile } from "@/lib/business-access";
import { prisma } from "@/lib/prisma";
import { getPrototypeProblemStatusLabel } from "@/lib/prototype-status";
import { CloseProblemButton } from "@/components/business/close-problem-button";
import {
  ArrowDownToLine,
  ArrowLeft,
  Clock3,
  FileText,
  Paperclip,
  UsersRound,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export const instant = false;

const statusVariants: Record<
  string,
  "default" | "secondary" | "success" | "warning" | "destructive"
> = {
  DRAFT: "secondary",
  PENDING_REVIEW: "warning",
  NEEDS_REVISION: "warning",
  CHANGES_REQUESTED: "warning",
  REJECTED: "destructive",
  APPROVED: "success",
  PUBLISHED: "success",
  TEAM_SELECTED: "default",
  PROTOTYPING: "default",
  EVALUATING: "warning",
  CLOSED: "secondary",
  READY_FOR_IMPLEMENTATION: "success",
  COMPLETED: "success",
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

export default async function BusinessProblemDetailPage({
  params,
}: {
  params: Promise<{ problemId: string }>;
}) {
  const { problemId } = await params;
  const { businessProfileId } = await requireBusinessProfile();
  const problem = await prisma.problem.findFirst({
    where: { id: problemId, businessProfileId },
    include: {
      attachments: { orderBy: { createdAt: "asc" } },
      applications: {
        where: { status: "SELECTED" },
        take: 1,
        select: { id: true },
      },
      _count: {
        select: { applications: { where: activeApplicationsWhere } },
      },
    },
  });
  if (!problem) {
    notFound();
  }

  const editable = ["DRAFT", "NEEDS_REVISION", "CHANGES_REQUESTED", "REJECTED"].includes(problem.status);
  const canReviewApplications = [
    "APPROVED",
    "PUBLISHED",
    "TEAM_SELECTED",
    "PROTOTYPING",
    "EVALUATING",
  ].includes(problem.status);
  const hasWorkspace = [
    "TEAM_SELECTED",
    "PROTOTYPING",
    "EVALUATING",
    "CLOSED",
    "READY_FOR_IMPLEMENTATION",
    "COMPLETED",
  ].includes(problem.status);

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <Link
        className={`${buttonVariants({ variant: "ghost", size: "sm" })} -ml-3 w-fit`}
        href="/business/problems"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Bài toán của tôi
      </Link>

      <Card>
        <CardContent className="p-5 sm:p-7">
          <div className="flex min-w-0 flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-primary">Chi tiết bài toán</p>
              <h1 className="mt-2 break-words text-2xl font-bold tracking-tight sm:text-3xl [overflow-wrap:anywhere]">
                {problem.title}
              </h1>
              <div className="mt-4 flex min-w-0 flex-wrap items-center gap-2">
                <Badge
                  className="max-w-full whitespace-normal break-words"
                  variant={statusVariants[problem.status] ?? "secondary"}
                >
                  {getPrototypeProblemStatusLabel(problem)}
                </Badge>
                <Badge className="max-w-full whitespace-normal break-words" variant="outline">
                  {problem.field}
                </Badge>
              </div>
            </div>

            <div className="flex w-full shrink-0 flex-col gap-3 xl:w-auto xl:max-w-[30rem]">
              <div className="grid gap-2 sm:grid-cols-2 xl:flex xl:flex-wrap xl:justify-end">
                {editable && (
                  <Link
                    className={`${buttonVariants({ variant: "outline" })} w-full xl:w-auto`}
                    href={`/business/problems/${problem.id}/edit`}
                  >
                    Chỉnh sửa
                  </Link>
                )}
                {canReviewApplications && (
                  <Link
                    className={`${buttonVariants({})} w-full xl:w-auto`}
                    href={`/business/problems/${problem.id}/applications`}
                  >
                    <UsersRound aria-hidden="true" className="h-4 w-4 shrink-0" />
                    {problem._count.applications > 0
                      ? `Xem ${problem._count.applications} hồ sơ ứng tuyển`
                      : "Chưa có hồ sơ"}
                  </Link>
                )}
                {hasWorkspace && (
                  <Link
                    className={`${buttonVariants({ variant: "outline" })} w-full xl:w-auto`}
                    href={`/business/problems/${problem.id}/workspace?applicationId=${problem.applications[0]?.id ?? ""}`}
                  >
                    Mở không gian làm việc
                  </Link>
                )}
              </div>
              {["APPROVED", "PUBLISHED"].includes(problem.status) && (
                <div className="flex justify-stretch xl:justify-end">
                  <CloseProblemButton problemId={problem.id} />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {problem.reviewNote && (
        <Card
          className={
            problem.status === "REJECTED"
              ? "border-destructive/30 bg-destructive/5"
              : "border-warning/30 bg-warning/5"
          }
        >
          <CardContent className="p-5 sm:p-6">
            <Badge variant={problem.status === "REJECTED" ? "destructive" : "warning"}>
              {problem.status === "REJECTED" ? "Lý do từ chối" : "Ghi chú kiểm duyệt"}
            </Badge>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 [overflow-wrap:anywhere]">
              {problem.reviewNote}
            </p>
          </CardContent>
        </Card>
      )}

      <section
        aria-label="Tổng quan bài toán"
        className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <Card>
          <CardContent className="flex min-w-0 items-start gap-3 p-5">
            <div className="rounded-xl bg-primary/10 p-2 text-primary">
              <Clock3 aria-hidden="true" className="h-5 w-5" />
            </div>
            <dl className="min-w-0">
              <dt className="text-sm text-muted-foreground">Thời gian dự kiến</dt>
              <dd className="mt-1 break-words text-sm font-semibold leading-6 [overflow-wrap:anywhere]">
                {problem.expectedDuration}
              </dd>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex min-w-0 items-start gap-3 p-5">
            <div className="rounded-xl bg-primary/10 p-2 text-primary">
              <Wallet aria-hidden="true" className="h-5 w-5" />
            </div>
            <dl className="min-w-0">
              <dt className="text-sm text-muted-foreground">Ngân sách tham khảo</dt>
              <dd className="mt-1 break-words text-sm font-semibold leading-6 [overflow-wrap:anywhere]">
                {formatCurrency(problem.budgetMin)} – {formatCurrency(problem.budgetMax)}
              </dd>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex min-w-0 items-start gap-3 p-5">
            <div className="rounded-xl bg-primary/10 p-2 text-primary">
              <UsersRound aria-hidden="true" className="h-5 w-5" />
            </div>
            <dl className="min-w-0">
              <dt className="text-sm text-muted-foreground">Hồ sơ ứng tuyển</dt>
              <dd className="mt-1 text-sm font-semibold leading-6">
                {problem._count.applications}
              </dd>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex min-w-0 items-start gap-3 p-5">
            <div className="rounded-xl bg-primary/10 p-2 text-primary">
              <Paperclip aria-hidden="true" className="h-5 w-5" />
            </div>
            <dl className="min-w-0">
              <dt className="text-sm text-muted-foreground">Tài liệu đính kèm</dt>
              <dd className="mt-1 text-sm font-semibold leading-6">
                {problem.attachments.length}
              </dd>
            </dl>
          </CardContent>
        </Card>
      </section>

      <div className="grid min-w-0 gap-5">
        <Card>
          <CardContent className="p-5 sm:p-7">
            <section aria-labelledby="problem-description-heading">
              <h2 className="text-lg font-semibold" id="problem-description-heading">
                Mô tả vấn đề
              </h2>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-muted-foreground [overflow-wrap:anywhere]">
                {problem.description}
              </p>
            </section>
          </CardContent>
        </Card>
        <div className="grid min-w-0 gap-5 lg:grid-cols-2">
          <Card>
            <CardContent className="p-5 sm:p-7">
              <section aria-labelledby="problem-goal-heading">
                <h2 className="text-lg font-semibold" id="problem-goal-heading">
                  Mục tiêu
                </h2>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-muted-foreground [overflow-wrap:anywhere]">
                  {problem.goal}
                </p>
              </section>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 sm:p-7">
              <section aria-labelledby="problem-requirements-heading">
                <h2 className="text-lg font-semibold" id="problem-requirements-heading">
                  Yêu cầu đối với nhóm sinh viên
                </h2>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-muted-foreground [overflow-wrap:anywhere]">
                  {problem.requirements}
                </p>
              </section>
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardContent className="p-5 sm:p-7">
            <section aria-labelledby="problem-attachments-heading">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-primary/10 p-2 text-primary">
                  <FileText aria-hidden="true" className="h-5 w-5" />
                </div>
                <h2 className="pt-1 text-lg font-semibold" id="problem-attachments-heading">
                  Tài liệu liên quan
                </h2>
              </div>
              {problem.attachments.length ? (
                <ul className="mt-5 divide-y divide-border rounded-xl border border-border">
                  {problem.attachments.map((attachment) => (
                    <li
                      className="flex min-w-0 flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                      key={attachment.id}
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <FileText
                          aria-hidden="true"
                          className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
                        />
                        <div className="min-w-0">
                          <p className="break-words text-sm font-medium leading-6 [overflow-wrap:anywhere]">
                            {attachment.originalName}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {(attachment.sizeBytes / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <a
                        aria-label={`Tải tài liệu ${attachment.originalName}`}
                        className={`${buttonVariants({ variant: "outline", size: "sm" })} w-full shrink-0 sm:w-auto`}
                        href={`/api/business/attachments/${attachment.id}`}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <ArrowDownToLine aria-hidden="true" className="h-4 w-4" />
                        Tải tài liệu
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  className="mt-5 py-8"
                  description="Chưa có tài liệu đính kèm."
                  title="Chưa có tài liệu"
                />
              )}
            </section>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
