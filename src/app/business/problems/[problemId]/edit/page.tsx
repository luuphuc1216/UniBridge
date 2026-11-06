import Link from "next/link";
import { notFound } from "next/navigation";
import { ProblemForm } from "@/components/business/problem-form";
import { updateProblemAction } from "../../actions";
import { requireBusinessProfile } from "@/lib/business-access";
import { prisma } from "@/lib/prisma";

export const instant = false;

export default async function EditBusinessProblemPage({
  params,
}: {
  params: Promise<{ problemId: string }>;
}) {
  const { problemId } = await params;
  const { businessProfileId } = await requireBusinessProfile();
  const problem = await prisma.problem.findFirst({
    where: {
      id: problemId,
      businessProfileId,
      status: { in: ["DRAFT", "NEEDS_REVISION", "CHANGES_REQUESTED", "REJECTED"] },
    },
    include: { attachments: { orderBy: { createdAt: "asc" } } },
  });
  if (!problem) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <Link
        className="text-sm font-semibold text-primary hover:underline"
        href={`/business/problems/${problem.id}`}
      >
        ← Chi tiết bài toán
      </Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">Chỉnh sửa bài toán</h1>
      <p className="mb-8 mt-2 text-sm leading-6 text-muted-foreground">
        Chỉ bài toán nháp hoặc được yêu cầu chỉnh sửa mới có thể thay đổi.
      </p>
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-8">
        <ProblemForm
          action={updateProblemAction}
          attachments={problem.attachments}
          problem={problem}
        />
      </section>
    </main>
  );
}
