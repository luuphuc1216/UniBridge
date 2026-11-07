import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarClock,
  ClipboardCheck,
  FileClock,
  ShieldAlert,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAdmin } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import {
  ensureAdminHandoffReminders,
  isAdminHandoffOverdue,
} from "@/lib/prototype-reminders";

export const instant = false;

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function ProposalHandoffQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  await requireAdmin();
  const { result } = await searchParams;
  const now = new Date();
  try {
    await ensureAdminHandoffReminders({ clock: { now: () => now } });
  } catch (error) {
    console.error("Không thể tạo nhắc nhở kiểm tra bàn giao cho Admin:", error);
  }
  const attempts = await prisma.proposalSubmissionAttempt.findMany({
    where: {
      proposal: {
        is: {
          handoffStatus: "PENDING_REVIEW",
          application: {
            is: {
              status: "SELECTED",
              problem: { is: { status: "PROTOTYPING", prototypeLegacy: false } },
            },
          },
        },
      },
    },
    orderBy: { submittedAt: "asc" },
    include: {
      proposal: {
        include: {
          submissionAttempts: {
            orderBy: { attempt: "desc" },
            take: 1,
            select: { id: true },
          },
          application: {
            include: {
              problem: {
                select: {
                  id: true,
                  title: true,
                  status: true,
                  prototypeLegacy: true,
                  businessProfile: { select: { companyName: true } },
                },
              },
              team: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  const latestAttempts = attempts.filter(
    ({ id, proposal }) => proposal.submissionAttempts[0]?.id === id,
  );
  const resultMessage =
    result === "approved"
      ? "Đã gửi lựa chọn đạt kiểm tra. Kết quả thực tế phụ thuộc cả checklist và kiểm tra tự động; hồ sơ có thể được trả nhóm bổ sung."
      : result === "returned"
        ? "Đã trả nhóm bổ sung."
        : null;

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      <header className="max-w-3xl">
        <p className="text-sm font-semibold text-primary">Khu vực quản trị</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Kiểm tra bàn giao Prototype
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">
          Kiểm tra tính đầy đủ, phạm vi hồ sơ và việc tuân thủ. Đây không phải đánh giá
          chuyên môn hay chất lượng giải pháp.
        </p>
      </header>

      <aside
        className="mt-5 flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm leading-6 text-foreground sm:p-5"
        role="note"
      >
        <ClipboardCheck
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 text-primary"
        />
        <p>
          Hàng đợi này chỉ hiển thị lần nộp mới nhất của Proposal đang chờ Admin kiểm tra.
          Các lần nộp đã xử lý hoặc bị thay thế không nằm trong hàng đợi này.
        </p>
      </aside>

      {resultMessage && (
        <p
          aria-live="polite"
          className="mt-5 rounded-xl border border-success/30 bg-success/10 p-4 text-sm text-foreground"
          role="status"
        >
          {resultMessage}
        </p>
      )}

      <section aria-label="Hàng đợi bàn giao" className="mt-7">
        {latestAttempts.length === 0 ? (
          <EmptyState
            className="bg-card"
            description="Các lần bàn giao đủ điều kiện kiểm tra sẽ xuất hiện tại đây."
            icon={<ClipboardCheck aria-hidden="true" className="size-5" />}
            title="Chưa có bàn giao cần kiểm tra"
          />
        ) : (
          <ol className="grid gap-4">
            {latestAttempts.map(({ id, attempt, submittedAt, proposal }) => {
              const { problem } = proposal.application;
              const overdue = isAdminHandoffOverdue(
                problem,
                proposal.handoffStatus,
                submittedAt,
                now,
              );
              return (
                <li key={id}>
                  <Card className="min-w-0 overflow-hidden p-0">
                    <div className="grid min-w-0 lg:grid-cols-[minmax(0,1fr)_auto]">
                      <div className="min-w-0 p-5 sm:p-6">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="gap-1.5" variant="warning">
                            <FileClock aria-hidden="true" className="size-3.5" />
                            Chờ kiểm tra
                          </Badge>
                          <Badge variant="outline">Lần nộp mới nhất</Badge>
                          {overdue && (
                            <Badge className="gap-1.5" variant="destructive">
                              <ShieldAlert aria-hidden="true" className="size-3.5" />
                              Quá hạn kiểm tra
                            </Badge>
                          )}
                        </div>
                        <h2 className="mt-3 break-words text-lg font-semibold sm:text-xl">
                          {problem.title}
                        </h2>
                        <p className="mt-1 break-all text-xs text-muted-foreground">
                          Mã bài toán: {problem.id}
                        </p>
                        <dl className="mt-4 grid min-w-0 gap-3 text-sm sm:grid-cols-2">
                          <div className="flex min-w-0 items-start gap-2">
                            <Building2
                              aria-hidden="true"
                              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                            />
                            <div className="min-w-0">
                              <dt className="text-xs text-muted-foreground">Doanh nghiệp</dt>
                              <dd className="break-words font-medium">
                                {problem.businessProfile.companyName}
                              </dd>
                            </div>
                          </div>
                          <div className="flex min-w-0 items-start gap-2">
                            <Users
                              aria-hidden="true"
                              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                            />
                            <div className="min-w-0">
                              <dt className="text-xs text-muted-foreground">Nhóm sinh viên</dt>
                              <dd className="break-words font-medium">
                                {proposal.application.team.name}
                              </dd>
                            </div>
                          </div>
                        </dl>
                        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-4 text-sm">
                          <p>
                            <span className="text-muted-foreground">Proposal </span>
                            <span className="font-medium">v{proposal.version}</span>
                            <span className="mx-1.5 text-muted-foreground">·</span>
                            <span className="text-muted-foreground">Lần nộp </span>
                            <span className="font-medium">{attempt}</span>
                          </p>
                          <p className="flex items-center gap-1.5 text-muted-foreground">
                            <CalendarClock aria-hidden="true" className="size-4" />
                            <time dateTime={submittedAt.toISOString()}>
                              {dateFormatter.format(submittedAt)}
                            </time>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center border-t border-border bg-muted/30 p-5 sm:p-6 lg:border-l lg:border-t-0">
                        <Link
                          className={`${buttonVariants()} w-full sm:w-auto`}
                          href={`/admin/prototype-handoffs/${id}`}
                        >
                          Mở kiểm tra
                          <ArrowRight aria-hidden="true" className="size-4" />
                        </Link>
                      </div>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </main>
  );
}
