import Link from "next/link";
import { requireStudent } from "@/lib/student-access";
import { getOwnedTeam } from "@/lib/student-team";
import { prisma } from "@/lib/prisma";

export const instant = false;

const statusLabels: Record<string, string> = {
  SUBMITTED: "Đã gửi",
  REJECTED: "Chưa được chọn",
  WITHDRAWN: "Đã rút",
  SELECTED: "Đã được chọn",
};

export default async function StudentApplicationsPage() {
  const { userId } = await requireStudent();
  const team = await getOwnedTeam(userId);
  const applications = team
    ? await prisma.application.findMany({
        where: { teamId: team.id },
        orderBy: { updatedAt: "desc" },
        include: {
          problem: {
            select: {
              id: true,
              title: true,
              field: true,
              status: true,
              businessProfile: { select: { companyName: true } },
            },
          },
        },
      })
    : [];

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <p className="text-sm font-semibold text-primary">Khu vực sinh viên</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Hồ sơ đã gửi</h1>
      {!team ? (
        <section className="mt-7 rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <h2 className="font-semibold">Bạn chưa tạo hồ sơ nhóm</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Tạo hồ sơ nhóm trước khi gửi đăng ký cho doanh nghiệp.
          </p>
          <Link className="mt-4 inline-flex text-sm font-semibold text-primary hover:underline" href="/student/team">
            Tạo hồ sơ nhóm
          </Link>
        </section>
      ) : applications.length === 0 ? (
        <section className="mt-7 rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <h2 className="font-semibold">Chưa có hồ sơ ứng tuyển</h2>
          <Link className="mt-3 inline-flex text-sm font-semibold text-primary hover:underline" href="/student/problems">
            Khám phá bài toán
          </Link>
        </section>
      ) : (
        <div className="mt-7 grid gap-4">
          {applications.map((application) => (
            <article
              className="rounded-2xl border border-border bg-card p-5 sm:p-6"
              key={application.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-primary">{application.problem.field}</p>
                  <h2 className="mt-1 text-lg font-semibold">{application.problem.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {application.problem.businessProfile.companyName}
                  </p>
                  <p className="mt-2 text-xs font-medium text-primary">
                    {application.problem.status === "PROTOTYPING"
                      ? "Đang xây dựng Prototype / Solution Proposal"
                      : application.problem.status === "EVALUATING"
                        ? "Doanh nghiệp đang đánh giá Proposal"
                        : application.problem.status === "CLOSED"
                          ? "Đã kết thúc – không triển khai"
                          : application.problem.status === "READY_FOR_IMPLEMENTATION"
                            ? "Sẵn sàng sang Paid Implementation"
                            : application.problem.status === "COMPLETED"
                              ? "Paid Implementation đã hoàn tất"
                            : application.problem.status === "TEAM_SELECTED"
                              ? "Đã chọn nhóm"
                              : ""}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    application.status === "SELECTED"
                      ? "bg-emerald-100 text-emerald-800"
                      : application.status === "REJECTED"
                        ? "bg-rose-100 text-rose-800"
                        : "bg-primary/10 text-primary"
                  }`}
                >
                  {statusLabels[application.status] ?? application.status}
                </span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Thời gian dự kiến: {application.estimatedDuration}
              </p>
              <Link
                className="mt-4 inline-flex text-sm font-semibold text-primary hover:underline"
                href={`/student/problems/${application.problem.id}`}
              >
                Xem bài toán và hồ sơ
              </Link>
              {application.status === "SELECTED" &&
                ["TEAM_SELECTED", "PROTOTYPING", "EVALUATING", "CLOSED", "READY_FOR_IMPLEMENTATION", "COMPLETED"].includes(
                  application.problem.status,
                ) && (
                  <Link
                    className="ml-4 inline-flex text-sm font-semibold text-primary hover:underline"
                    href={`/student/workspace/${application.problem.id}`}
                  >
                    Mở không gian làm việc
                  </Link>
                )}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
