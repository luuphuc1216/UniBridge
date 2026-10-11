import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusinessProfile } from "@/lib/business-access";
import { prisma } from "@/lib/prisma";

export const instant = false;

const statusLabels: Record<string, string> = {
  DRAFT: "Bản nháp",
  PENDING_REVIEW: "Chờ duyệt",
  NEEDS_REVISION: "Cần chỉnh sửa",
  CHANGES_REQUESTED: "Cần chỉnh sửa",
  APPROVED: "Đã duyệt",
  PUBLISHED: "Đang nhận hồ sơ",
  TEAM_SELECTED: "Đã chọn nhóm",
  COMPLETED: "Đã hoàn thành",
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
      _count: { select: { applications: true } },
    },
  });
  if (!problem) {
    notFound();
  }

  const editable = ["DRAFT", "NEEDS_REVISION", "CHANGES_REQUESTED"].includes(problem.status);
  const canReviewApplications = ["APPROVED", "PUBLISHED", "TEAM_SELECTED"].includes(
    problem.status,
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <Link className="text-sm font-semibold text-primary hover:underline" href="/business/problems">
        ← Bài toán của tôi
      </Link>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">{problem.field}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{problem.title}</h1>
          <span className="mt-3 inline-flex rounded-full bg-muted px-3 py-1 text-sm font-semibold">
            {statusLabels[problem.status] ?? problem.status}
          </span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {editable && (
            <Link
              className="rounded-xl border border-border px-4 py-2.5 text-center text-sm font-semibold hover:bg-muted"
              href={`/business/problems/${problem.id}/edit`}
            >
              Chỉnh sửa
            </Link>
          )}
          {canReviewApplications && (
            <Link
              className="rounded-xl bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground hover:opacity-90"
              href={`/business/problems/${problem.id}/applications`}
            >
              Xem {problem._count.applications} hồ sơ ứng tuyển
            </Link>
          )}
        </div>
      </div>

      {problem.reviewNote && (
        <section className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <h2 className="font-semibold">Ghi chú kiểm duyệt</h2>
          <p className="mt-1">{problem.reviewNote}</p>
        </section>
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
            <p className="mt-2 text-sm text-muted-foreground">{problem.expectedDuration}</p>
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
          {problem.attachments.length ? (
            <ul className="mt-3 divide-y divide-border">
              {problem.attachments.map((attachment) => (
                <li className="py-3 first:pt-0 last:pb-0" key={attachment.id}>
                  <a
                    className="break-all text-sm font-medium text-primary hover:underline"
                    href={`/api/business/attachments/${attachment.id}`}
                    rel="noreferrer"
                    target="_blank"
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
    </main>
  );
}
