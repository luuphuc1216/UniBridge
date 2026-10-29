import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin-access";
import { getProposalHandoffPageData } from "@/lib/proposal-handoff-page-data";
import { ProposalHandoffReviewForm } from "@/components/admin/proposal-handoff-review-form";
import {
  ensureAdminHandoffReminders,
  isAdminHandoffOverdue,
} from "@/lib/prototype-reminders";

export const instant = false;

export default async function ProposalHandoffReviewPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  await requireAdmin();
  const { attemptId } = await params;
  const now = new Date();
  try {
    await ensureAdminHandoffReminders({
      attemptId,
      clock: { now: () => now },
    });
  } catch (error) {
    console.error("Không thể tạo nhắc nhở kiểm tra bàn giao cho Admin:", error);
  }
  const detail = await getProposalHandoffPageData(attemptId, "ADMIN");
  if (detail.kind === "not-found") {
    notFound();
  }
  const { attempt } = detail;
  const { problem } = attempt.proposal.application;
  const brief = problem.trialBriefVersions[0];
  const overdue = isAdminHandoffOverdue(
    problem,
    attempt.proposal.handoffStatus,
    attempt.submittedAt,
    now,
  );

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <p className="text-sm font-semibold text-primary">Khu vực quản trị</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Kiểm tra bàn giao</h1>
      <p className="mt-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
        Nền tảng chỉ kiểm tra tính đầy đủ, phạm vi hồ sơ và việc tuân thủ quy định; không đánh giá chuyên môn hay chất lượng giải pháp.
      </p>

      <section className="mt-6 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-xl font-semibold">{problem.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {problem.businessProfile.companyName} · Nhóm {attempt.proposal.application.team.name}
        </p>
        {overdue && (
          <p className="mt-2 w-fit rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-800">
            Quá hạn kiểm tra
          </p>
        )}
        <p className="mt-3 text-sm">
          Phiên bản {attempt.proposal.version}, lần nộp {attempt.attempt} ·{" "}
          {new Intl.DateTimeFormat("vi-VN", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(attempt.submittedAt)}
        </p>
        {brief && (
          <dl className="mt-5 grid gap-3 text-sm">
            <div><dt className="font-semibold">Mục tiêu đã thống nhất</dt><dd className="mt-1 whitespace-pre-wrap">{brief.objective}</dd></div>
            <div><dt className="font-semibold">Phạm vi</dt><dd className="mt-1 whitespace-pre-wrap">{brief.scope}</dd></div>
            <div><dt className="font-semibold">Sản phẩm đầu ra</dt><dd className="mt-1 whitespace-pre-wrap">{brief.deliverables}</dd></div>
            <div><dt className="font-semibold">Hạn</dt><dd className="mt-1">{new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(brief.deadline)}</dd></div>
          </dl>
        )}
        <h3 className="mt-6 font-semibold">Nội dung lần nộp</h3>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{attempt.description}</p>
        <h3 className="mt-6 font-semibold">Tệp bàn giao</h3>
        {attempt.files.length ? (
          <ul className="mt-2 space-y-2">
            {attempt.files.map((file) => (
              <li key={file.id}>
                <a className="text-sm font-medium text-primary hover:underline" href={`/api/workspace/proposals/${file.id}`}>
                  {file.originalName}
                </a>
                <span className="ml-2 text-xs text-muted-foreground">
                  ({(file.sizeBytes / 1024 / 1024).toFixed(2)} MB)
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Không có tệp đính kèm; kiểm tra đường dẫn/đầu ra trong nội dung bàn giao.</p>
        )}
      </section>

      {detail.kind === "pending" ? (
        <ProposalHandoffReviewForm attemptId={attempt.id} problemId={problem.id} />
      ) : detail.kind === "superseded" ? (
        <p className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          Lần nộp này đã được thay thế bởi lần nộp {detail.latestAttempt.attempt}.
          {" "}
          <Link
            className="font-semibold underline"
            href={`/admin/prototype-handoffs/${detail.latestAttempt.id}`}
          >
            Mở lần nộp mới nhất
          </Link>
        </p>
      ) : (
        <section className="mt-6 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Kết quả kiểm tra bàn giao</h2>
          {detail.review ? (
            <>
              <p className="mt-2 text-sm">
                {detail.review.result === "APPROVED" ? "Đã duyệt bàn giao" : "Đã trả nhóm bổ sung"}
                {" · "}{detail.review.reviewedBy.name}
                {" · "}{new Intl.DateTimeFormat("vi-VN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(detail.review.createdAt)}
              </p>
              <ul className="mt-4 space-y-2 text-sm">
                <li>Tệp hoặc đường dẫn đầy đủ: {detail.review.filesOrLinksComplete ? "Đạt" : "Chưa đạt"}</li>
                <li>Đúng phạm vi hồ sơ: {detail.review.withinTrialBriefScope ? "Đạt" : "Chưa đạt"}</li>
                <li>Tuân thủ quy định: {detail.review.compliesWithRules ? "Đạt" : "Chưa đạt"}</li>
              </ul>
              <p className="mt-4 whitespace-pre-wrap text-sm">{detail.review.note}</p>
              {detail.review.missingItems && (
                <div className="mt-3 text-sm">
                  <h3 className="font-semibold">Mục cần bổ sung</h3>
                  <ul className="mt-1 list-inside list-disc whitespace-pre-wrap">
                    {detail.review.missingItems.split("\n").map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Lần nộp đã được xử lý ({attempt.proposal.handoffStatus}); không thể kiểm tra lại.
            </p>
          )}
        </section>
      )}
    </main>
  );
}
