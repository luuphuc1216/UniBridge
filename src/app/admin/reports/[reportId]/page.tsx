import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  FileWarning,
  History,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireAdmin } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import {
  reportActionStatuses,
  type ReportStatus,
  reportTargetTypes,
} from "@/lib/reports";
import { updateReportAction } from "../actions";

const statusLabels: Record<ReportStatus, string> = {
  NEW: "Mới",
  IN_PROGRESS: "Đang xử lý",
  RESOLVED: "Đã xử lý",
  DISMISSED: "Bác bỏ",
};

const targetLabels: Record<(typeof reportTargetTypes)[number], string> = {
  PROBLEM: "Vấn đề",
  TEAM: "Hồ sơ nhóm",
  MESSAGE: "Tin nhắn",
  REVIEW: "Đánh giá",
};

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
  timeStyle: "short",
});

function getStatusVariant(status: string) {
  if (status === "NEW") return "warning" as const;
  if (status === "IN_PROGRESS") return "default" as const;
  if (status === "RESOLVED") return "success" as const;
  if (status === "DISMISSED") return "secondary" as const;
  return "outline" as const;
}

export default async function AdminReportDetailPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  await requireAdmin();
  const { reportId } = await params;
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: {
      reporter: { select: { id: true, name: true, role: true } },
      handler: { select: { name: true } },
    },
  });
  if (!report) notFound();

  const [relatedReports, relatedAuditLogs] = await Promise.all([
    prisma.report.findMany({
      where: {
        targetType: report.targetType,
        targetId: report.targetId,
        id: { not: report.id },
      },
      orderBy: { createdAt: "desc" },
      include: { reporter: { select: { name: true } } },
    }),
    prisma.auditLog.findMany({
      where: {
        targetId: report.targetId,
        targetType:
          report.targetType === "PROBLEM"
            ? "Problem"
            : report.targetType === "TEAM"
              ? "StudentTeam"
              : report.targetType === "MESSAGE"
                ? "WorkspaceMessage"
                : "Review",
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { actor: { select: { name: true } } },
    }),
  ]);

  let currentContent: string | null = null;
  let targetHidden = false;
  if (report.targetType === "PROBLEM") {
    const target = await prisma.problem.findUnique({
      where: { id: report.targetId },
      select: { title: true, description: true, hiddenByAdmin: true },
    });
    if (target) {
      currentContent = `${target.title}\n\n${target.description}`;
      targetHidden = target.hiddenByAdmin;
    }
  } else if (report.targetType === "TEAM") {
    const target = await prisma.studentTeam.findUnique({
      where: { id: report.targetId },
      select: { name: true, description: true, hiddenByAdmin: true },
    });
    if (target) {
      currentContent = `${target.name}\n\n${target.description}`;
      targetHidden = target.hiddenByAdmin;
    }
  } else if (report.targetType === "MESSAGE") {
    const target = await prisma.workspaceMessage.findUnique({
      where: { id: report.targetId },
      select: { content: true, hiddenByAdmin: true },
    });
    if (target) {
      currentContent = target.content;
      targetHidden = target.hiddenByAdmin;
    }
  } else if (report.targetType === "REVIEW") {
    const target = await prisma.review.findUnique({
      where: { id: report.targetId },
      select: { content: true, rating: true, hiddenByAdmin: true },
    });
    if (target) {
      currentContent = `${target.rating}/5\n\n${target.content}`;
      targetHidden = target.hiddenByAdmin;
    }
  }

  const status = report.status as ReportStatus;
  const targetType = report.targetType as (typeof reportTargetTypes)[number];
  const canProcess = report.status === "NEW" || report.status === "IN_PROGRESS";

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      <Link
        className={`${buttonVariants({ variant: "outline" })} mb-5`}
        href="/admin/reports"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Danh sách báo cáo
      </Link>

      <header className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-primary">Quản lý báo cáo</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              Chi tiết báo cáo
            </h1>
            <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <div>
                <dt className="inline text-muted-foreground">Loại nội dung: </dt>
                <dd className="inline font-medium">
                  {targetLabels[targetType] ?? report.targetType}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="inline text-muted-foreground">Mã báo cáo: </dt>
                <dd className="break-all font-medium">{report.id}</dd>
              </div>
            </dl>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="px-3 py-1.5 text-sm" variant={getStatusVariant(report.status)}>
              {statusLabels[status] ?? report.status}
            </Badge>
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarClock aria-hidden="true" className="size-4" />
              <time dateTime={report.createdAt.toISOString()}>
                {dateFormatter.format(report.createdAt)}
              </time>
            </span>
          </div>
        </div>
      </header>

      <p className="mt-5 flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm leading-6 text-foreground sm:p-5">
        <ShieldAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <span>
          Chỉ xử lý theo căn cứ và chính sách hiện hành; không tự kết luận bên nào có lỗi khi chưa đủ căn cứ.
          Việc báo cáo không phải lý do để thay đổi điểm đánh giá.
        </span>
      </p>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(20rem,0.7fr)]">
        <div className="grid min-w-0 gap-5">
          <Card className="min-w-0 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <FileWarning
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-primary"
              />
              <div>
                <h2 className="text-lg font-semibold">Thông tin báo cáo</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Căn cứ được gửi bởi người báo cáo.
                </p>
              </div>
            </div>
            <dl className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-muted-foreground">Người báo cáo</dt>
                <dd className="mt-1 break-words font-semibold">
                  {report.reporter.name}
                </dd>
                <dd className="mt-1 text-sm text-muted-foreground">
                  {report.reporter.role}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Đối tượng bị báo cáo</dt>
                <dd className="mt-1 font-semibold">
                  {targetLabels[targetType] ?? report.targetType}
                </dd>
                <dd className="mt-1 break-all text-sm text-muted-foreground">
                  {report.targetId}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm font-semibold">Lý do báo cáo</dt>
                <dd className="mt-2 whitespace-pre-wrap break-words rounded-xl border border-border bg-muted/40 p-4 text-sm leading-6">
                  {report.reason}
                </dd>
              </div>
            </dl>
          </Card>

          <section aria-labelledby="content-comparison-heading" className="min-w-0">
            <div className="mb-3">
              <p className="text-sm font-semibold text-primary">Nội dung bị báo cáo</p>
              <h2 className="mt-1 text-lg font-semibold" id="content-comparison-heading">
                Đối chiếu snapshot và nội dung hiện tại
              </h2>
            </div>
            {currentContent !== null ? (
              <div className="grid min-w-0 gap-4 lg:grid-cols-2">
                <Card className="min-w-0 overflow-hidden p-0">
                  <div className="border-b border-border bg-muted/40 p-4">
                    <h3 className="font-semibold">Tại thời điểm báo cáo</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Snapshot đã lưu cùng báo cáo; không bị thay bằng nội dung mới.
                    </p>
                  </div>
                  <pre className="max-h-[32rem] min-w-0 overflow-auto whitespace-pre-wrap break-words p-4 font-sans text-sm leading-6">
                    {report.snapshot}
                  </pre>
                </Card>
                <Card className="min-w-0 overflow-hidden p-0">
                  <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border bg-muted/40 p-4">
                    <div>
                      <h3 className="font-semibold">Nội dung hiện tại</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Chỉ hiển thị trong trang quản trị.
                      </p>
                    </div>
                    {targetHidden && (
                      <Badge className="gap-1" variant="warning">
                        <ShieldCheck aria-hidden="true" className="size-3.5" />
                        Đang ẩn với người dùng
                      </Badge>
                    )}
                  </div>
                  <p className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-words p-4 text-sm leading-6">
                    {currentContent}
                  </p>
                </Card>
              </div>
            ) : (
              <div className="grid min-w-0 gap-4 lg:grid-cols-2">
                <Card className="min-w-0 overflow-hidden p-0">
                  <div className="border-b border-border bg-muted/40 p-4">
                    <h3 className="font-semibold">Tại thời điểm báo cáo</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Snapshot đã lưu cùng báo cáo; không bị thay bằng nội dung mới.
                    </p>
                  </div>
                  <pre className="max-h-[32rem] min-w-0 overflow-auto whitespace-pre-wrap break-words p-4 font-sans text-sm leading-6">
                    {report.snapshot}
                  </pre>
                </Card>
                <div className="flex min-w-0 items-center rounded-2xl border border-dashed border-border bg-muted/30 p-5 text-sm text-muted-foreground">
                  Nội dung hiện tại không còn tồn tại; không thể đối chiếu với snapshot.
                </div>
              </div>
            )}
          </section>

          <Card className="min-w-0 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <History aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
              <div>
                <h2 className="text-lg font-semibold">Báo cáo và nhật ký liên quan</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Các bản ghi hiện có cho cùng đối tượng.
                </p>
              </div>
            </div>
            {relatedReports.length === 0 && relatedAuditLogs.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                Chưa có báo cáo hoặc nhật ký liên quan khác.
              </p>
            ) : (
              <div className="mt-4 grid gap-5 md:grid-cols-2">
                <section aria-labelledby="related-reports-heading" className="min-w-0">
                  <h3 className="text-sm font-semibold" id="related-reports-heading">
                    Báo cáo liên quan
                  </h3>
                  {relatedReports.length > 0 ? (
                    <ul className="mt-2 divide-y divide-border rounded-xl border border-border px-3">
                      {relatedReports.map((item) => (
                        <li className="min-w-0 py-3" key={item.id}>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={getStatusVariant(item.status)}>
                              {statusLabels[item.status as ReportStatus] ?? item.status}
                            </Badge>
                            <span className="break-words text-sm font-medium">
                              {item.reporter.name}
                            </span>
                          </div>
                          <time
                            className="mt-2 block text-xs text-muted-foreground"
                            dateTime={item.createdAt.toISOString()}
                          >
                            {dateFormatter.format(item.createdAt)}
                          </time>
                          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                            {item.resolutionReason ?? item.reason}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Chưa có báo cáo liên quan khác.
                    </p>
                  )}
                </section>
                <section aria-labelledby="related-audit-heading" className="min-w-0">
                  <h3 className="text-sm font-semibold" id="related-audit-heading">
                    Nhật ký liên quan
                  </h3>
                  {relatedAuditLogs.length > 0 ? (
                    <ol className="mt-2 divide-y divide-border rounded-xl border border-border px-3">
                      {relatedAuditLogs.map((item) => (
                        <li className="min-w-0 py-3" key={item.id}>
                          <p className="break-words text-sm font-semibold">{item.action}</p>
                          <p className="mt-1 break-words text-sm text-muted-foreground">
                            Người thực hiện: {item.actor.name}
                          </p>
                          <time
                            className="mt-2 block text-xs text-muted-foreground"
                            dateTime={item.createdAt.toISOString()}
                          >
                            {dateFormatter.format(item.createdAt)}
                          </time>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Chưa có nhật ký liên quan.
                    </p>
                  )}
                </section>
              </div>
            )}
          </Card>
        </div>

        <aside className="grid min-w-0 gap-5">
          <Card className="min-w-0 p-5 sm:p-6">
            <h2 className="text-lg font-semibold">Kết quả xử lý hiện tại</h2>
            {report.resolutionReason ? (
              <>
                <p className="mt-4 whitespace-pre-wrap break-words rounded-xl bg-muted/40 p-4 text-sm leading-6">
                  {report.resolutionReason}
                </p>
                {report.handler && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Người xử lý:{" "}
                    <span className="font-medium text-foreground">
                      {report.handler.name}
                    </span>
                  </p>
                )}
              </>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                Chưa có lý do xử lý được ghi nhận.
              </p>
            )}
            {report.handledAt && (
              <p className="mt-2 text-sm text-muted-foreground">
                Thời điểm xử lý:{" "}
                <time dateTime={report.handledAt.toISOString()}>
                  {dateFormatter.format(report.handledAt)}
                </time>
              </p>
            )}
          </Card>

          {canProcess ? (
            <section
              aria-labelledby="report-action-heading"
              className="min-w-0 rounded-2xl border-2 border-primary/20 bg-card p-5 shadow-sm sm:p-6"
            >
              <p className="text-sm font-semibold text-primary">Thao tác quản trị</p>
              <h2 className="mt-1 text-lg font-semibold" id="report-action-heading">
                Xử lý báo cáo
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Báo cáo đang ở trạng thái có thể xử lý. Ghi rõ căn cứ và kết quả để lưu lại nhật ký.
              </p>
              <form action={updateReportAction} className="mt-5 grid gap-3">
                <input name="reportId" type="hidden" value={report.id} />
                <label className="text-sm font-semibold" htmlFor="report-status">
                  Trạng thái mới
                </label>
                <select
                  className="min-h-11 rounded-xl border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  id="report-status"
                  name="status"
                  required
                >
                  {reportActionStatuses
                    .filter((nextStatus) => nextStatus !== report.status)
                    .map((nextStatus) => (
                      <option key={nextStatus} value={nextStatus}>
                        {statusLabels[nextStatus]}
                      </option>
                    ))}
                </select>

                <label className="mt-2 text-sm font-semibold" htmlFor="resolution-reason">
                  Lý do xử lý <span className="text-destructive">*</span>
                </label>
                <textarea
                  className="min-h-28 rounded-xl border border-input bg-background px-3 py-3 text-base leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  id="resolution-reason"
                  maxLength={500}
                  name="reason"
                  required
                />
                <p className="-mt-1 text-xs text-muted-foreground">
                  Bắt buộc, tối đa 500 ký tự.
                </p>

                <div className="rounded-xl border border-warning/40 bg-warning/10 p-4">
                  <p className="text-sm font-semibold">Lưu ý về việc ẩn nội dung</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Chỉ chọn ẩn khi trạng thái mới là “Đã xử lý”. Thao tác này ẩn nội dung với người dùng và ghi nhận audit; không thay đổi điểm đánh giá.
                  </p>
                  <label
                    className="mt-3 flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-warning/30 bg-background/70 p-3 text-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
                    htmlFor="hide-content"
                  >
                    <input
                      className="mt-0.5 size-4 shrink-0 accent-primary"
                      id="hide-content"
                      name="hideContent"
                      type="checkbox"
                    />
                    <span className="font-medium leading-6">
                      Ẩn nội dung vi phạm theo chính sách (chỉ ẩn nội dung, không đổi điểm đánh giá).
                    </span>
                  </label>
                </div>

                <Button className="mt-1 w-full sm:w-fit" type="submit">
                  Lưu kết quả xử lý
                </Button>
              </form>
            </section>
          ) : (
            <section
              aria-labelledby="report-closed-heading"
              className="rounded-2xl border border-border bg-muted/30 p-5 sm:p-6"
            >
              <h2 className="font-semibold" id="report-closed-heading">
                Báo cáo đã kết thúc xử lý
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Không có thao tác cập nhật trên trang này với trạng thái hiện tại.
              </p>
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}
