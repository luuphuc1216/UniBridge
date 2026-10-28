import Link from "next/link";
import { requireAdmin } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";

export const instant = false;

export default async function ProposalHandoffQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  await requireAdmin();
  const { result } = await searchParams;
  const attempts = await prisma.proposalSubmissionAttempt.findMany({
    where: {
      proposal: {
        is: {
          handoffStatus: "PENDING_REVIEW",
          application: {
            is: {
              status: "SELECTED",
              problem: { is: { status: "PROTOTYPING", prototypeLegacy: false } },
            },
          },
        },
      },
    },
    orderBy: { submittedAt: "asc" },
    include: {
      proposal: {
        include: {
          submissionAttempts: {
            orderBy: { attempt: "desc" },
            take: 1,
            select: { id: true },
          },
          application: {
            include: {
              problem: {
                select: {
                  id: true,
                  title: true,
                  businessProfile: { select: { companyName: true } },
                },
              },
              team: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  const latestAttempts = attempts.filter(
    ({ id, proposal }) => proposal.submissionAttempts[0]?.id === id,
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <p className="text-sm font-semibold text-primary">Khu vực quản trị</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Kiểm tra bàn giao Prototype</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Chỉ kiểm tra tính đầy đủ và tuân thủ bàn giao; không đánh giá chuyên môn giải pháp.
      </p>
      {result === "approved" || result === "returned" ? (
        <p className="mt-4 rounded-lg bg-emerald-100 p-3 text-sm text-emerald-900" role="status">
          {result === "approved" ? "Đã duyệt bàn giao." : "Đã trả nhóm bổ sung."}
        </p>
      ) : null}

      {latestAttempts.length === 0 ? (
        <section className="mt-8 rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <h2 className="font-semibold">Chưa có bàn giao cần kiểm tra</h2>
        </section>
      ) : (
        <ul className="mt-8 grid gap-4">
          {latestAttempts.map(({ id, attempt, submittedAt, proposal }) => {
            const { problem } = proposal.application;
            return (
              <li className="rounded-2xl border border-border bg-card p-5" key={id}>
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div>
                    <h2 className="font-semibold">{problem.title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {problem.businessProfile.companyName} · Nhóm {proposal.application.team.name}
                    </p>
                    <p className="mt-2 text-sm">
                      Phiên bản {proposal.version}, lần nộp {attempt} ·{" "}
                      {new Intl.DateTimeFormat("vi-VN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(submittedAt)}
                    </p>
                  </div>
                  <Link
                    className="rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground"
                    href={`/admin/prototype-handoffs/${id}`}
                  >
                    Kiểm tra bàn giao
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
