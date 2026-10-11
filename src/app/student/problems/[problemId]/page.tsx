import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/student-access";
import { prisma } from "@/lib/prisma";

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

export default async function StudentProblemDetailPage({
  params,
}: {
  params: Promise<{ problemId: string }>;
}) {
  await requireStudent();
  const { problemId } = await params;
  const problem = await prisma.problem.findFirst({
    where: {
      id: problemId,
      status: { in: ["APPROVED", "PUBLISHED", "TEAM_SELECTED"] },
    },
    include: {
      businessProfile: { select: { companyName: true, industry: true } },
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
        href="/student/problems"
      >
        ← Danh sách bài toán
      </Link>
      <p className="mt-4 text-sm font-semibold text-primary">{problem.field}</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">{problem.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {problem.businessProfile.companyName} · {problem.businessProfile.industry}
      </p>

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
            <p className="mt-2 text-sm text-muted-foreground">
              {problem.expectedDuration}
            </p>
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
          {problem.attachments.length > 0 ? (
            <ul className="mt-3 divide-y divide-border">
              {problem.attachments.map((attachment) => (
                <li className="py-3 first:pt-0 last:pb-0" key={attachment.id}>
                  <a
                    className="break-all text-sm font-medium text-primary hover:underline"
                    href={`/api/business/attachments/${attachment.id}`}
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
