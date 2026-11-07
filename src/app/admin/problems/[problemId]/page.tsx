import Link from "next/link";
import { ArrowLeft, Building2, CalendarClock, FileText, Wallet } from "lucide-react";
import { notFound } from "next/navigation";
import {
  AiProblemReviewPanel,
  ProblemOverrideForm,
  ProblemReviewForm,
} from "@/components/admin/problem-review-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { getPrototypeProblemStatusLabel } from "@/lib/prototype-status";

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

function getStatusVariant(status: string) {
  if (status === "PENDING_REVIEW") return "warning" as const;
  if (status === "REJECTED") return "destructive" as const;
  if (["APPROVED", "PUBLISHED", "TEAM_SELECTED"].includes(status)) {
    return "success" as const;
  }
  if (["NEEDS_REVISION", "CHANGES_REQUESTED"].includes(status)) {
    return "warning" as const;
  }
  return "secondary" as const;
}

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function AdminProblemDetailPage({
  params,
}: {
  params: Promise<{ problemId: string }>;
}) {
  await requireAdmin();
  const { problemId } = await params;
  const problem = await prisma.problem.findUnique({
    where: { id: problemId },
    include: {
      businessProfile: {
        include: {
          user: { select: { name: true, email: true } },
        },
      },
      attachments: { orderBy: { createdAt: "asc" } },
      aiReviews: {
        where: { feature: "PROBLEM_MODERATION" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  if (!problem) {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      <Link
        className={`${buttonVariants({ variant: "outline" })} mb-5`}
        href="/admin/problems"
      >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Danh sách vấn đề
      </Link>

      <header className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Building2 aria-hidden="true" className="size-4 shrink-0" />
              <span className="break-words">{problem.businessProfile.companyName}</span>
            </p>
            <h1 className="mt-3 break-words text-2xl font-bold tracking-tight sm:text-3xl">
              {problem.title}
            </h1>
            <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <span>{problem.field}</span>
              <span className="flex items-center gap-1.5">
                <CalendarClock aria-hidden="true" className="size-4" />
                Gửi lúc{" "}
                {problem.submittedAt
                  ? dateFormatter.format(problem.submittedAt)
                  : "Chưa gửi"}
              </span>
            </p>
          </div>
          <Badge
            className="w-fit shrink-0 px-3 py-1.5 text-sm"
            variant={getStatusVariant(problem.status)}
          >
            {getPrototypeProblemStatusLabel(problem)}
          </Badge>
        </div>
      </header>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.85fr)]">
        <div className="grid min-w-0 gap-5">
          <Card className="min-w-0 p-5 sm:p-7">
            <div className="border-b border-border pb-4">
              <h2 className="text-lg font-semibold">Nội dung vấn đề</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Thông tin do doanh nghiệp cung cấp để Admin rà soát.
              </p>
            </div>
            <dl className="mt-5 grid min-w-0 gap-x-6 gap-y-5 text-sm sm:grid-cols-2">
              <div className="min-w-0 sm:col-span-2">
                <dt className="font-semibold">Mô tả vấn đề</dt>
                <dd className="mt-2 whitespace-pre-wrap break-words leading-7 text-muted-foreground">
                  {problem.description}
                </dd>
              </div>
              <div className="min-w-0 sm:col-span-2">
                <dt className="font-semibold">Mục tiêu</dt>
                <dd className="mt-2 whitespace-pre-wrap break-words leading-7 text-muted-foreground">
                  {problem.goal}
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Lĩnh vực</dt>
                <dd className="mt-2 text-muted-foreground">{problem.field}</dd>
              </div>
              <div>
                <dt className="font-semibold">Thời gian dự kiến</dt>
                <dd className="mt-2 text-muted-foreground">
                  {problem.expectedDuration}
                </dd>
              </div>
              <div className="min-w-0 sm:col-span-2">
                <dt className="font-semibold">Yêu cầu đối với nhóm sinh viên</dt>
                <dd className="mt-2 whitespace-pre-wrap break-words leading-7 text-muted-foreground">
                  {problem.requirements}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="flex items-center gap-2 font-semibold">
                  <Wallet aria-hidden="true" className="size-4" />
                  Ngân sách tham khảo
                </dt>
                <dd className="mt-2 text-muted-foreground">
                  {formatCurrency(problem.budgetMin)} – {formatCurrency(problem.budgetMax)}
                </dd>
              </div>
            </dl>
          </Card>

          <Card className="min-w-0 p-5 sm:p-7">
            <div className="flex items-start gap-3">
              <FileText
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-primary"
              />
              <div>
                <h2 className="text-lg font-semibold">Tài liệu đính kèm</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tệp do doanh nghiệp gửi kèm vấn đề.
                </p>
              </div>
            </div>
            {problem.attachments.length > 0 ? (
              <ul className="mt-4 divide-y divide-border rounded-xl border border-border px-4">
                {problem.attachments.map((attachment) => (
                  <li
                    className="flex min-w-0 flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"
                    key={attachment.id}
                  >
                    <a
                      className="min-w-0 break-all text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      href={`/api/business/attachments/${attachment.id}`}
                    >
                      {attachment.originalName}
                    </a>
                    <span className="text-sm text-muted-foreground sm:shrink-0">
                      {attachment.contentType} ·{" "}
                      {(attachment.sizeBytes / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                Không có tài liệu đính kèm.
              </p>
            )}
          </Card>

          {problem.reviewNote && (
            <section
              aria-labelledby="previous-review-heading"
              className="rounded-2xl border border-warning/40 bg-warning/10 p-5 sm:p-6"
            >
              <h2 className="font-semibold" id="previous-review-heading">
                {problem.status === "REJECTED"
                  ? "Lý do từ chối"
                  : "Lý do chỉnh sửa trước đó"}
              </h2>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">
                {problem.reviewNote}
              </p>
            </section>
          )}
        </div>

        <aside className="grid min-w-0 gap-5">
          <Card className="min-w-0 p-5 sm:p-6">
            <div className="border-b border-border pb-4">
              <h2 className="text-lg font-semibold">Thông tin doanh nghiệp</h2>
              <p className="mt-1 break-words font-medium text-foreground">
                {problem.businessProfile.companyName}
              </p>
            </div>
            <dl className="mt-4 grid min-w-0 gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Lĩnh vực hoạt động</dt>
                <dd className="mt-1 break-words font-medium">
                  {problem.businessProfile.industry}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Người liên hệ</dt>
                <dd className="mt-1 break-words font-medium">
                  {problem.businessProfile.user.name}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Email</dt>
                <dd className="mt-1 break-all font-medium">
                  {problem.businessProfile.user.email}
                </dd>
              </div>
              {problem.businessProfile.website && (
                <div>
                  <dt className="text-muted-foreground">Website</dt>
                  <dd className="mt-1 break-all font-medium">
                    {problem.businessProfile.website}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-muted-foreground">Giới thiệu doanh nghiệp</dt>
                <dd className="mt-1 whitespace-pre-wrap break-words leading-6">
                  {problem.businessProfile.description}
                </dd>
              </div>
            </dl>
          </Card>

          <AiProblemReviewPanel
            initialResult={
              problem.aiReviews[0]
                ? {
                    checklist: problem.aiReviews[0].checklist as {
                      key: string;
                      passed: boolean;
                      reason: string;
                    }[],
                    conclusion: problem.aiReviews[0].conclusion ?? "UNCERTAIN",
                    reason: problem.aiReviews[0].reason ?? "",
                  }
                : undefined
            }
            initialReviewStatus={problem.aiReviews[0]?.status}
            initialReviewVersion={problem.aiReviews[0]?.problemVersion}
            problemId={problem.id}
            problemVersion={problem.version}
          />

          <section className="min-w-0 rounded-2xl border-2 border-primary/20 bg-card p-5 shadow-sm sm:p-6">
            <div className="mb-5">
              <p className="text-sm font-semibold text-primary">Quyết định của Admin</p>
              <h2 className="mt-1 text-lg font-semibold">
                {problem.status === "PENDING_REVIEW"
                  ? "Kiểm duyệt vấn đề"
                  : "Điều chỉnh trạng thái kiểm duyệt"}
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Kết quả AI chỉ mang tính tham khảo. Quyết định cuối cùng do Admin thực hiện.
              </p>
            </div>
            {problem.status === "PENDING_REVIEW" ? (
              <ProblemReviewForm problemId={problem.id} />
            ) : (
              <ProblemOverrideForm problemId={problem.id} />
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}
