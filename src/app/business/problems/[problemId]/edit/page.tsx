import Link from "next/link";
import { notFound } from "next/navigation";
import { ProblemForm } from "@/components/business/problem-form";
import { updateProblemAction } from "../../actions";
import { requireBusinessProfile } from "@/lib/business-access";
import { prisma } from "@/lib/prisma";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getPrototypeProblemStatusLabel } from "@/lib/prototype-status";

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
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <header className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
        <Link
          className={`${buttonVariants({ variant: "ghost", size: "sm" })}
            -ml-3 w-fit motion-reduce:transition-none`}
          href={`/business/problems/${problem.id}`}
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Chi tiết bài toán
        </Link>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Chỉnh sửa bài toán
          </h1>
          <Badge variant="outline">{getPrototypeProblemStatusLabel(problem)}</Badge>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Chỉ bài toán nháp hoặc được yêu cầu chỉnh sửa mới có thể thay đổi.
        </p>
      </header>
      <ProblemForm
        action={updateProblemAction}
        attachments={problem.attachments}
        problem={problem}
      />
    </main>
  );
}
