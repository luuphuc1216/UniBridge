import Link from "next/link";
import { requireStudent } from "@/lib/student-access";
import { getOwnedTeam } from "@/lib/student-team";
import { prisma } from "@/lib/prisma";
import { getApplicationStatusDisplay } from "@/lib/application-status";
import { getPrototypeProblemStatusLabel } from "@/lib/prototype-status";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FileText, Search, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";

export const instant = false;

function getApplicationBadgeVariant(
  status: string,
): "outline" | "warning" | "success" | "secondary" | "destructive" {
  const tone = getApplicationStatusDisplay(status).tone;
  if (tone === "pending") return "warning";
  if (tone === "success") return "success";
  if (tone === "muted") return "secondary";
  if (tone === "danger") return "destructive";
  return "outline";
}

export default async function StudentApplicationsPage() {
  const { userId } = await requireStudent();
  const team = await getOwnedTeam(userId);
  const applications = team
    ? await prisma.application.findMany({
      where: { teamId: team.id, status: { not: "DRAFT" } },
        orderBy: { updatedAt: "desc" },
        include: {
        approachAttachments: {
          select: {
            id: true,
            originalName: true,
            sizeBytes: true,
            submissionVersion: true,
          },
        },
        problem: {
            select: {
              id: true,
              title: true,
              field: true,
              status: true,
              prototypeLegacy: true,
              evaluationResult: true,
              implementationDecision: true,
              businessProfile: { select: { companyName: true } },
            },
          },
        },
      })
    : [];

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">KHÔNG GIAN SINH VIÊN</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Hồ sơ đã gửi</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Theo dõi phản hồi của doanh nghiệp và mở lại hồ sơ gắn với từng bài toán.
          </p>
        </div>
        <Link
          className={cn(buttonVariants({ variant: "outline" }), "w-full sm:w-auto")}
          href="/student/problems"
        >
          <Search aria-hidden="true" className="size-4" />
          Khám phá bài toán
        </Link>
      </header>
      {!team ? (
        <EmptyState
          action={
            <Link
              className={buttonVariants()}
              href="/student/team"
            >
              Tạo hồ sơ nhóm
            </Link>
          }
          className="mt-7"
          description="Tạo hồ sơ nhóm trước khi gửi Profile + Approach cho doanh nghiệp."
          icon={<UsersRound aria-hidden="true" className="size-5" />}
          title="Bạn chưa tạo hồ sơ nhóm"
        />
      ) : applications.length === 0 ? (
        <EmptyState
          action={
            <Link className={buttonVariants()} href="/student/problems">
              Khám phá bài toán
            </Link>
          }
          className="mt-7"
          description="Các hồ sơ bạn gửi sẽ xuất hiện tại đây cùng trạng thái mới nhất."
          icon={<FileText aria-hidden="true" className="size-5" />}
          title="Chưa có hồ sơ ứng tuyển"
        />
      ) : (
        <div className="mt-7 grid gap-4">
          {applications.map((application) => (
            <Card className="p-5 transition-[border-color,box-shadow] duration-200 hover:border-primary/30 hover:shadow-md motion-reduce:transition-none sm:p-6" key={application.id}>
              <article>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-primary">{application.problem.field}</p>
                  <h2 className="mt-1 break-words text-lg font-semibold tracking-tight sm:text-xl">{application.problem.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {application.problem.businessProfile.companyName}
                  </p>
                  <p className="mt-3 text-xs font-medium text-muted-foreground">
                    Tình trạng bài toán: <span className="text-foreground">{getPrototypeProblemStatusLabel(application.problem)}</span>
                  </p>
                </div>
                <Badge
                  className="shrink-0"
                  variant={getApplicationBadgeVariant(application.status)}
                >
                  {getApplicationStatusDisplay(application.status).label}
                </Badge>
              </div>
              <dl className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Thời gian dự kiến</dt>
                  <dd className="mt-1 text-sm font-medium">{application.estimatedDuration}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Cập nhật gần nhất</dt>
                  <dd className="mt-1 text-sm font-medium">
                    {new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(application.updatedAt)}
                  </dd>
                </div>
              </dl>
              {application.approachAttachments.filter(
                ({ submissionVersion }) =>
                  submissionVersion === application.attachmentVersion,
              ).length > 0 && (
                <section aria-label="Tài liệu minh họa đã gửi" className="mt-4 rounded-xl border border-border bg-muted/20 p-4">
                  <h3 className="text-sm font-semibold">Tài liệu minh họa đã gửi</h3>
                  <ul className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                    {application.approachAttachments
                      .filter(
                        ({ submissionVersion }) =>
                          submissionVersion === application.attachmentVersion,
                      )
                      .map((attachment) => (
                        <li className="min-w-0 rounded-lg bg-background p-3" key={attachment.id}>
                          <a
                            className="break-all font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            href={`/api/approach/attachments/${attachment.id}`}
                          >
                            {attachment.originalName}
                          </a>{" "}
                          <span className="text-muted-foreground">
                            ({(attachment.sizeBytes / 1024 / 1024).toFixed(2)} MB)
                          </span>
                        </li>
                      ))}
                  </ul>
                </section>
              )}
              <div className="mt-5 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:flex-wrap">
                <Link
                  className={cn(buttonVariants({ variant: "outline" }), "w-full sm:w-auto")}
                  href={`/student/problems/${application.problem.id}`}
                >
                  Xem bài toán và hồ sơ
                </Link>
                {application.status === "SELECTED" &&
                  ["TEAM_SELECTED", "PROTOTYPING", "EVALUATING", "CLOSED", "READY_FOR_IMPLEMENTATION", "COMPLETED"].includes(
                    application.problem.status,
                  ) && (
                  <Link
                    className={cn(buttonVariants(), "w-full sm:w-auto")}
                    href={`/student/workspace/${application.problem.id}?applicationId=${application.id}`}
                  >
                    Mở không gian làm việc
                  </Link>
                )}
              </div>
              </article>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
