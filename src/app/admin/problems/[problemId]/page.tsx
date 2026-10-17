import Link from "next/link";
import { notFound } from "next/navigation";
import { ProblemReviewForm } from "@/components/admin/problem-review-form";
import { requireAdmin } from "@/lib/admin-access";
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
  PROTOTYPING: "Đang xây dựng Prototype / Solution Proposal",
  EVALUATING: "Doanh nghiệp đang đánh giá",
  CLOSED: "Đã kết thúc – không triển khai",
  READY_FOR_IMPLEMENTATION: "Sẵn sàng sang Paid Implementation",
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
    },
  });
  if (!problem) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <Link
        className="text-sm font-semibold text-primary hover:underline"
        href="/admin/problems"
      >
        ← Danh sách bài toán
      </Link>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">{problem.field}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{problem.title}</h1>
        </div>
        <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">
          {statusLabels[problem.status] ?? problem.status}
        </span>
      </div>

      <section className="mt-6 rounded-2xl border border-border bg-card p-5 sm:p-7">
        <h2 className="text-lg font-semibold">Thông tin doanh nghiệp</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Tên doanh nghiệp</dt>
            <dd className="mt-1 font-medium">{problem.businessProfile.companyName}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Lĩnh vực hoạt động</dt>
            <dd className="mt-1 font-medium">{problem.businessProfile.industry}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Người liên hệ</dt>
            <dd className="mt-1 font-medium">{problem.businessProfile.user.name}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Email</dt>
            <dd className="mt-1 break-all font-medium">{problem.businessProfile.user.email}</dd>
          </div>
          {problem.businessProfile.website && (
            <div>
              <dt className="text-muted-foreground">Website</dt>
              <dd className="mt-1 break-all font-medium">{problem.businessProfile.website}</dd>
            </div>
          )}
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Giới thiệu doanh nghiệp</dt>
            <dd className="mt-1 whitespace-pre-wrap leading-6">
              {problem.businessProfile.description}
            </dd>
          </div>
        </dl>
      </section>

      <div className="mt-5 grid gap-5">
        <section className="rounded-2xl border border-border bg-card p-5 sm:p-7">
          <h2 className="text-lg font-semibold">Thông tin bài toán</h2>
          <dl className="mt-4 grid gap-5 text-sm sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="font-semibold">Mô tả vấn đề</dt>
              <dd className="mt-2 whitespace-pre-wrap leading-7 text-muted-foreground">
                {problem.description}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-semibold">Mục tiêu</dt>
              <dd className="mt-2 whitespace-pre-wrap leading-7 text-muted-foreground">
                {problem.goal}
              </dd>
            </div>
            <div>
              <dt className="font-semibold">Lĩnh vực</dt>
              <dd className="mt-2 text-muted-foreground">{problem.field}</dd>
            </div>
            <div>
              <dt className="font-semibold">Thời gian dự kiến</dt>
              <dd className="mt-2 text-muted-foreground">{problem.expectedDuration}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-semibold">Yêu cầu đối với nhóm sinh viên</dt>
              <dd className="mt-2 whitespace-pre-wrap leading-7 text-muted-foreground">
                {problem.requirements}
              </dd>
            </div>
            <div>
              <dt className="font-semibold">Ngân sách tham khảo</dt>
              <dd className="mt-2 text-muted-foreground">
                {formatCurrency(problem.budgetMin)} – {formatCurrency(problem.budgetMax)}
              </dd>
            </div>
            <div>
              <dt className="font-semibold">Thời điểm gửi duyệt</dt>
              <dd className="mt-2 text-muted-foreground">
                {problem.submittedAt
                  ? new Intl.DateTimeFormat("vi-VN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(problem.submittedAt)
                  : "Chưa gửi"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 sm:p-7">
          <h2 className="text-lg font-semibold">Tài liệu đính kèm</h2>
          {problem.attachments.length > 0 ? (
            <ul className="mt-3 divide-y divide-border">
              {problem.attachments.map((attachment) => (
                <li className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between" key={attachment.id}>
                  <a
                    className="break-all text-sm font-medium text-primary hover:underline"
                    href={`/api/business/attachments/${attachment.id}`}
                  >
                    {attachment.originalName}
                  </a>
                  <span className="text-sm text-muted-foreground">
                    {(attachment.sizeBytes / 1024 / 1024).toFixed(2)} MB
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Không có tài liệu đính kèm.</p>
          )}
        </section>

        {problem.reviewNote && (
          <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            <h2 className="font-semibold">Lý do chỉnh sửa trước đó</h2>
            <p className="mt-1 whitespace-pre-wrap">{problem.reviewNote}</p>
          </section>
        )}

        {problem.status === "PENDING_REVIEW" ? (
          <section className="rounded-2xl border border-border bg-card p-5 sm:p-7">
            <h2 className="mb-5 text-lg font-semibold">Kết quả kiểm duyệt</h2>
            <ProblemReviewForm problemId={problem.id} />
          </section>
        ) : (
          <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
            Bài toán này không còn ở trạng thái chờ duyệt nên không thể thay đổi kết quả kiểm duyệt.
          </p>
        )}
      </div>
    </main>
  );
}
