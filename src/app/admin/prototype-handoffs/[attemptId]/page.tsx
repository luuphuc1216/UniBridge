import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  ShieldAlert,
  Users,
} from "lucide-react";
import { notFound } from "next/navigation";
import { ProposalHandoffReviewForm } from "@/components/admin/proposal-handoff-review-form";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireAdmin } from "@/lib/admin-access";
import { getProposalHandoffPageData } from "@/lib/proposal-handoff-page-data";
import { validateProposalHandoffCompleteness } from "@/lib/proposal-handoff";
import {
  ensureAdminHandoffReminders,
  isAdminHandoffOverdue,
} from "@/lib/prototype-reminders";

export const instant = false;

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
  timeStyle: "short",
});

const reviewCriteria = [
  ["filesOrLinksComplete", "Tệp hoặc đường dẫn bàn giao đầy đủ"],
  [
    "withinTrialBriefScope",
    "Nằm trong phạm vi hồ sơ thử nghiệm đã thống nhất",
  ],
  ["compliesWithRules", "Tuân thủ quy định của nền tảng"],
] as const;

function ResultBadge({ passed }: { passed: boolean }) {
  return (
    <Badge className="gap-1.5" variant={passed ? "success" : "destructive"}>
      {passed ? (
        <CheckCircle2 aria-hidden="true" className="size-3.5" />
      ) : (
        <ShieldAlert aria-hidden="true" className="size-3.5" />
      )}
      {passed ? "Đạt" : "Chưa đạt"}
    </Badge>
  );
}

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
  const automaticCheck = validateProposalHandoffCompleteness({
    description: attempt.description,
    type: attempt.proposal.type,
    files: attempt.files.map(({ originalName, contentType, sizeBytes }) => ({
      originalName,
      contentType,
      sizeBytes,
    })),
    deliverables: brief?.deliverables ?? "",
    deadline: brief?.deadline ?? new Date(0),
    submittedAt: attempt.submittedAt,
  });
  const handoffStatusLabel =
    detail.kind === "pending"
      ? "Chờ Admin kiểm tra"
      : detail.kind === "superseded"
        ? "Đã bị thay thế"
        : attempt.proposal.handoffStatus === "APPROVED"
          ? "Đã duyệt bàn giao"
          : attempt.proposal.handoffStatus === "RETURNED"
            ? "Đã trả nhóm bổ sung"
            : attempt.proposal.handoffStatus;

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      <Link
        className={`${buttonVariants({ variant: "outline" })} mb-5`}
        href="/admin/prototype-handoffs"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Hàng đợi bàn giao
      </Link>

      <header className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-primary">
              Kiểm tra Proposal / Prototype
            </p>
            <h1 className="mt-2 break-words text-2xl font-bold tracking-tight sm:text-3xl">
              {problem.title}
            </h1>
            <p className="mt-2 break-all text-xs text-muted-foreground">
              Mã bài toán: {problem.id}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              className="px-3 py-1.5 text-sm"
              variant={
                detail.kind === "pending"
                  ? "warning"
                  : detail.kind === "superseded"
                    ? "secondary"
                    : attempt.proposal.handoffStatus === "APPROVED"
                      ? "success"
                      : "outline"
              }
            >
              {handoffStatusLabel}
            </Badge>
            {overdue && detail.kind === "pending" && (
              <Badge className="gap-1.5" variant="destructive">
                <ShieldAlert aria-hidden="true" className="size-3.5" />
                Quá hạn kiểm tra
              </Badge>
            )}
          </div>
        </div>
        <dl className="mt-5 grid gap-4 border-t border-border pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex min-w-0 items-start gap-2">
            <Building2
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            />
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Doanh nghiệp</dt>
              <dd className="mt-1 break-words text-sm font-medium">
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
              <dd className="mt-1 break-words text-sm font-medium">
                {attempt.proposal.application.team.name}
              </dd>
            </div>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Proposal</dt>
            <dd className="mt-1 text-sm font-medium">
              v{attempt.proposal.version} · {attempt.proposal.type}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Lần nộp</dt>
            <dd className="mt-1 text-sm font-medium">
              {attempt.attempt}
              <span className="mx-1.5 text-muted-foreground">·</span>
              <time dateTime={attempt.submittedAt.toISOString()}>
                {dateFormatter.format(attempt.submittedAt)}
              </time>
            </dd>
          </div>
        </dl>
      </header>

      {detail.kind === "superseded" && (
        <aside
          className="mt-5 flex flex-col gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
          role="status"
        >
          <p className="text-sm leading-6">
            Lần nộp này đã được thay thế bởi lần nộp {detail.latestAttempt.attempt}.
            Không thể duyệt hoặc thay đổi kết quả của lần nộp cũ.
          </p>
          <Link
            className={`${buttonVariants({ variant: "outline" })} w-full shrink-0 sm:w-auto`}
            href={`/admin/prototype-handoffs/${detail.latestAttempt.id}`}
          >
            Mở lần nộp mới nhất
          </Link>
        </aside>
      )}

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(20rem,0.7fr)]">
        <div className="grid min-w-0 gap-5">
          {brief && (
            <Card className="min-w-0 p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <FileText
                  aria-hidden="true"
                  className="mt-0.5 size-5 shrink-0 text-primary"
                />
                <div>
                  <h2 className="text-lg font-semibold">
                    Hồ sơ thử nghiệm đã thống nhất
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Căn cứ đối chiếu phạm vi bàn giao.
                  </p>
                </div>
              </div>
              <dl className="mt-5 grid gap-4">
                <div>
                  <dt className="text-sm font-semibold">Mục tiêu đã thống nhất</dt>
                  <dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
                    {brief.objective}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold">Phạm vi</dt>
                  <dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
                    {brief.scope}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold">Sản phẩm đầu ra</dt>
                  <dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
                    {brief.deliverables}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold">Hạn bàn giao</dt>
                  <dd className="mt-1 text-sm text-muted-foreground">
                    <time dateTime={brief.deadline.toISOString()}>
                      {dateFormatter.format(brief.deadline)}
                    </time>
                  </dd>
                </div>
              </dl>
            </Card>
          )}

          <Card className="min-w-0 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <FileText
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-primary"
              />
              <div>
                <h2 className="text-lg font-semibold">Nội dung bàn giao</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Nội dung do nhóm sinh viên cung cấp trong lần nộp này.
                </p>
              </div>
            </div>
            <p className="mt-4 whitespace-pre-wrap break-words rounded-xl border border-border bg-muted/30 p-4 text-sm leading-6">
              {attempt.description}
            </p>

            <div className="mt-5 border-t border-border pt-5">
              <h3 className="font-semibold">Tệp bàn giao</h3>
              {attempt.files.length > 0 ? (
                <ul className="mt-3 divide-y divide-border rounded-xl border border-border px-4">
                  {attempt.files.map((file) => (
                    <li
                      className="flex min-w-0 flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                      key={file.id}
                    >
                      <a
                        className="break-all text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        href={`/api/workspace/proposals/${file.id}`}
                      >
                        {file.originalName}
                      </a>
                      <span className="break-words text-xs text-muted-foreground sm:shrink-0">
                        {file.contentType} · {(file.sizeBytes / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Không có tệp đính kèm; nội dung bàn giao có thể chứa đường dẫn demo.
                </p>
              )}
            </div>
          </Card>

          <section aria-labelledby="automatic-check-heading" className="min-w-0">
            <Card className="min-w-0 p-5 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <ShieldAlert
                    aria-hidden="true"
                    className="mt-0.5 size-5 shrink-0 text-primary"
                  />
                  <div>
                    <h2 className="text-lg font-semibold" id="automatic-check-heading">
                      Kiểm tra tự động về tính đầy đủ
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Đối chiếu mô tả, tệp/đường dẫn, thời hạn và sản phẩm đầu ra. Đây
                      không phải đánh giá chất lượng chuyên môn.
                    </p>
                  </div>
                </div>
                <ResultBadge passed={automaticCheck.passed} />
              </div>
              {automaticCheck.missingItems.length > 0 ? (
                <div className="mt-4 rounded-xl border border-warning/40 bg-warning/10 p-4">
                  <h3 className="text-sm font-semibold">Điều kiện tự động chưa đạt</h3>
                  <ul className="mt-2 list-inside list-disc space-y-1 text-sm leading-6">
                    {automaticCheck.missingItems.map((item, index) => (
                      <li className="break-words" key={`${index}-${item}`}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="mt-4 rounded-xl border border-success/30 bg-success/10 p-4 text-sm leading-6">
                  Không phát hiện thiếu sót theo các kiểm tra tự động hiện có.
                </p>
              )}
            </Card>
          </section>
        </div>

        <aside className="grid min-w-0 content-start gap-5">
          {detail.kind === "pending" ? (
            <ProposalHandoffReviewForm
              attemptId={attempt.id}
              automaticCheckPassed={automaticCheck.passed}
              problemId={problem.id}
            />
          ) : detail.kind === "processed" ? (
            <Card className="min-w-0 p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <ClipboardCheck
                  aria-hidden="true"
                  className="mt-0.5 size-5 shrink-0 text-primary"
                />
                <div>
                  <h2 className="text-lg font-semibold">Kết quả kiểm tra của Admin</h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Xác nhận tính đầy đủ và tuân thủ; không phải kết luận về chất lượng
                    chuyên môn của sản phẩm.
                  </p>
                </div>
              </div>
              {detail.review ? (
                <>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        detail.review.result === "APPROVED"
                          ? "success"
                          : "warning"
                      }
                    >
                      {detail.review.result === "APPROVED"
                        ? "Đạt kiểm tra bàn giao"
                        : "Trả nhóm bổ sung"}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {detail.review.reviewedBy.name}
                    </span>
                  </div>
                  <time
                    className="mt-2 block text-sm text-muted-foreground"
                    dateTime={detail.review.createdAt.toISOString()}
                  >
                    {dateFormatter.format(detail.review.createdAt)}
                  </time>
                  <ul className="mt-4 space-y-2">
                    {reviewCriteria.map(([key, label]) => (
                      <li
                        className="flex min-w-0 flex-col gap-2 rounded-xl border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                        key={key}
                      >
                        <span className="break-words text-sm font-medium">{label}</span>
                        <ResultBadge passed={detail.review[key]} />
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4">
                    <h3 className="text-sm font-semibold">Ghi chú kiểm tra</h3>
                    <p className="mt-2 whitespace-pre-wrap break-words rounded-xl bg-muted/40 p-4 text-sm leading-6">
                      {detail.review.note}
                    </p>
                  </div>
                  {detail.review.missingItems && (
                    <div className="mt-4">
                      <h3 className="text-sm font-semibold">Mục cần bổ sung</h3>
                      <ul className="mt-2 list-inside list-disc space-y-1 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm leading-6">
                        {detail.review.missingItems.split("\n").map((item, index) => (
                          <li
                            className="break-words"
                            key={`${index}-${item}`}
                          >
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <p className="mt-4 rounded-xl border border-dashed border-border p-4 text-sm leading-6 text-muted-foreground">
                  Lần nộp đã được xử lý ({attempt.proposal.handoffStatus}); không có
                  bản ghi kết quả kiểm tra liên kết với lần nộp này.
                </p>
              )}
            </Card>
          ) : (
            <Card className="min-w-0 p-5 sm:p-6">
              <h2 className="text-lg font-semibold">Không thể xử lý lần nộp này</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Lần nộp đã bị thay thế. Kết quả xử lý chỉ có thể thực hiện trên lần nộp
                mới nhất đang chờ kiểm tra.
              </p>
            </Card>
          )}

          {detail.kind === "pending" && (
            <aside className="rounded-2xl border border-warning/40 bg-warning/10 p-5">
              <h2 className="font-semibold">Phạm vi kiểm tra của Admin</h2>
              <p className="mt-2 text-sm leading-6">
                Đánh giá tính đầy đủ của hồ sơ, phạm vi bàn giao và việc tuân thủ tiêu
                chí hiện có. Không thay doanh nghiệp đánh giá chuyên môn giải pháp.
              </p>
              {!automaticCheck.passed && (
                <p className="mt-3 text-sm font-medium leading-6">
                  Kiểm tra tự động chưa đạt; workflow sẽ không chuyển bàn giao sang trạng
                  thái đã duyệt dù các mục checklist được đánh dấu đạt.
                </p>
              )}
            </aside>
          )}
        </aside>
      </div>
    </main>
  );
}
