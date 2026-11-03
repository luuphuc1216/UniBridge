import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { reportStatuses, type ReportStatus } from "@/lib/reports";
import { updateReportAction } from "../actions";

const statusLabels: Record<ReportStatus, string> = {
  NEW: "Mới",
  IN_PROGRESS: "Đang xử lý",
  RESOLVED: "Đã xử lý",
  DISMISSED: "Bác bỏ",
};

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

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <Link className="text-sm font-semibold text-primary hover:underline" href="/admin/reports">
        ← Danh sách báo cáo
      </Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">Chi tiết báo cáo</h1>
      <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
        Chỉ xử lý theo căn cứ và chính sách hiện hành; không tự kết luận bên nào có lỗi khi chưa đủ căn cứ.
        Việc báo cáo không phải lý do để thay đổi điểm đánh giá.
      </p>
      <section className="mt-6 grid gap-4 rounded-2xl border border-border bg-card p-5">
        <p><strong>Trạng thái:</strong> {statusLabels[report.status as ReportStatus] ?? report.status}</p>
        <p><strong>Người báo cáo:</strong> {report.reporter.name} ({report.reporter.role})</p>
        <p><strong>Lý do báo cáo:</strong></p>
        <p className="whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm">{report.reason}</p>
        <p><strong>Nội dung tại thời điểm báo cáo:</strong></p>
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm">{report.snapshot}</pre>
        <p className="flex flex-wrap items-center gap-2">
          <strong>Nội dung hiện tại (chỉ Admin thấy)</strong>
          {targetHidden && (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">
              Đang bị ẩn với người dùng
            </span>
          )}
        </p>
        <p className="whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm">
          {currentContent ?? "Nội dung không còn tồn tại."}
        </p>
        {report.resolutionReason && (
          <p><strong>Lý do xử lý:</strong> {report.resolutionReason}</p>
        )}
        {report.handler && <p><strong>Người xử lý:</strong> {report.handler.name}</p>}
      </section>
      <section className="mt-6 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">Lịch sử liên quan</h2>
        <ul className="mt-3 space-y-3 text-sm">
          {relatedReports.map((item) => (
            <li className="border-t border-border pt-3" key={item.id}>
              Báo cáo từ {item.reporter.name} · {statusLabels[item.status as ReportStatus] ?? item.status}
              {" · "}
              {new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(item.createdAt)}
              <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{item.resolutionReason ?? item.reason}</p>
            </li>
          ))}
          {relatedAuditLogs.map((item) => (
            <li className="border-t border-border pt-3" key={item.id}>
              Nhật ký: {item.action} · {item.actor.name} ·{" "}
              {new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(item.createdAt)}
            </li>
          ))}
          {relatedReports.length === 0 && relatedAuditLogs.length === 0 && (
            <li className="text-muted-foreground">Chưa có báo cáo hoặc nhật ký liên quan khác.</li>
          )}
        </ul>
      </section>
      {report.status === "NEW" || report.status === "IN_PROGRESS" ? (
        <form action={updateReportAction} className="mt-6 grid gap-3 rounded-2xl border border-border bg-card p-5">
          <input name="reportId" type="hidden" value={report.id} />
          <label className="text-sm font-medium" htmlFor="report-status">Trạng thái mới</label>
          <select className="rounded-lg border border-border bg-background px-3 py-2" id="report-status" name="status" required>
            {reportStatuses.filter((status) => status !== report.status && status !== "NEW").map((status) => (
              <option key={status} value={status}>{statusLabels[status]}</option>
            ))}
          </select>
          <label className="text-sm font-medium" htmlFor="resolution-reason">Lý do xử lý (bắt buộc)</label>
          <textarea
            className="min-h-24 rounded-lg border border-border bg-background px-3 py-2"
            id="resolution-reason"
            maxLength={500}
            name="reason"
            required
          />
          <label className="flex items-start gap-2 text-sm">
            <input className="mt-1" name="hideContent" type="checkbox" />
            <span>Ẩn nội dung vi phạm theo chính sách (chỉ ẩn nội dung, không đổi điểm đánh giá).</span>
          </label>
          <button className="w-fit rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground" type="submit">
            Lưu kết quả xử lý
          </button>
        </form>
      ) : null}
    </main>
  );
}
