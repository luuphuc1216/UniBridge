import Link from "next/link";
import { ArrowRight, BriefcaseBusiness } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

export type ProjectListItem = {
  id: string;
  title: string;
  status: string;
  totalAmount: number;
  application: { problem: { title: string } };
  transactions: {
    type: string;
    amount: number;
    platformFee: number;
    businessFee: number | null;
    businessFeeBasisPoints: number | null;
    studentFeeBasisPoints: number | null;
  }[];
};

const labels: Record<string, string> = {
  AGREEING: "Đang thỏa thuận",
  AWAITING_PAYMENT: "Chờ nạp tiền",
  IN_PROGRESS: "Đang thực hiện",
  COMPLETED: "Đã hoàn thành",
  CANCELLED: "Đã hủy",
};

function formatCurrency(amount: number) {
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(amount)} ₫`;
}

export function ProjectListView({
  projects,
  role,
  transactionDashboard = false,
}: {
  projects: ProjectListItem[];
  role: "BUSINESS" | "STUDENT";
  transactionDashboard?: boolean;
}) {
  const basePath = role === "BUSINESS" ? "/business" : "/student";
  const isStudent = role === "STUDENT";
  return (
    <main className={
      isStudent
        ? "mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8"
        : "mx-auto max-w-5xl px-4 py-7 sm:px-6 sm:py-10"
    }>
      {isStudent ? (
        <header className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-primary">KHÔNG GIAN SINH VIÊN</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              {transactionDashboard ? "Tổng quan giao dịch" : "Dự án Paid Implementation"}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              {transactionDashboard
                ? "Theo dõi các khoản được ghi nhận trong dự án của nhóm."
                : "Theo dõi trạng thái thỏa thuận, tiến độ và các mốc của dự án."}
            </p>
          </div>
          {transactionDashboard && (
            <Link
              className={cn(buttonVariants({ variant: "outline" }), "w-full sm:w-auto")}
              href="/student/projects"
            >
              Xem dự án
            </Link>
          )}
        </header>
      ) : (
        <>
          <p className="text-sm font-semibold text-primary">Khu vực doanh nghiệp</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            {transactionDashboard ? "Tổng quan giao dịch" : "Dự án Paid Implementation"}
          </h1>
        </>
      )}
      <aside
        className={`${isStudent ? "mt-5" : "mt-4"} rounded-xl border p-4 text-sm font-semibold leading-6 ${
          isStudent
            ? "border-warning/30 bg-warning/10 text-foreground"
            : "border-amber-300 bg-amber-50 text-amber-950"
        }`}
        role="note"
      >
        Thanh toán giả lập, không phát sinh giao dịch thật.
      </aside>
      {projects.length === 0 ? (
        isStudent ? (
          <EmptyState
            className="mt-6"
            description="Dự án sẽ xuất hiện tại đây sau khi doanh nghiệp gửi thỏa thuận."
            icon={<BriefcaseBusiness aria-hidden="true" className="size-5" />}
            title="Chưa có dự án Paid Implementation"
          />
        ) : (
          <section className="mt-6 rounded-2xl border border-dashed border-border bg-card p-8 text-center">
            <p className="font-semibold">Chưa có dự án Paid Implementation.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Dự án sẽ xuất hiện tại đây sau khi doanh nghiệp gửi thỏa thuận.
            </p>
          </section>
        )
      ) : (
        <div className="mt-6 grid gap-4">
          {projects.map((project) => {
            const releases = project.transactions.filter(
              (transaction) => transaction.type === "MILESTONE_RELEASE",
            );
            const deposits = project.transactions.filter(
              (transaction) => transaction.type === "DEPOSIT",
            );
            const deposited = deposits.reduce((sum, transaction) => sum + transaction.amount, 0);
            const businessFee = deposits.reduce(
              (sum, transaction) =>
                transaction.businessFeeBasisPoints !== null &&
                transaction.studentFeeBasisPoints !== null
                  ? sum + (transaction.businessFee ?? 0)
                  : sum,
              0,
            );
            const paidOut = releases.reduce((sum, transaction) => sum + transaction.amount, 0);
            const fee =
              businessFee +
              releases.reduce((sum, transaction) => sum + transaction.platformFee, 0);
            const hasLegacyDeposit = deposits.some(
              (transaction) =>
                transaction.businessFeeBasisPoints === null ||
                transaction.studentFeeBasisPoints === null,
            );
            const hasNewDeposit = deposits.some(
              (transaction) =>
                transaction.businessFeeBasisPoints !== null &&
                transaction.studentFeeBasisPoints !== null,
            );
            return (
              <article
                className={`rounded-2xl border border-border bg-card p-5 sm:p-6 ${
                  isStudent
                    ? "transition-[border-color,box-shadow] duration-200 hover:border-primary/30 hover:shadow-md motion-reduce:transition-none"
                    : ""
                }`}
                key={project.id}
              >
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {isStudent ? "Bài toán liên quan" : project.application.problem.title}
                    </p>
                    <h2 className="mt-1 text-lg font-semibold">{project.title}</h2>
                    {isStudent && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {project.application.problem.title}
                      </p>
                    )}
                  </div>
                  {isStudent ? (
                    <Badge
                      className="w-fit"
                      variant={
                        project.status === "COMPLETED"
                          ? "success"
                          : project.status === "CANCELLED"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {labels[project.status] ?? project.status}
                    </Badge>
                  ) : (
                    <span className="w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      {labels[project.status] ?? project.status}
                    </span>
                  )}
                </div>
                <p className={`mt-3 text-sm ${isStudent ? "rounded-xl bg-muted/40 p-3" : ""}`}>
                  Giá trị dự án: <strong>{formatCurrency(project.totalAmount)}</strong>
                </p>
                {transactionDashboard && (
                  <>
                    {hasLegacyDeposit && (
                      <p className="mt-2 text-xs font-semibold text-amber-800">
                        {isStudent
                          ? "Áp dụng chính sách phí được ghi nhận trước đây"
                          : "Áp dụng phí cũ 15%"}
                      </p>
                    )}
                    <dl className="mt-4 grid gap-3 border-t border-border pt-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                      {[
                        [isStudent ? "Tổng đã nạp (mô phỏng)" : "Tổng đã nạp", deposited],
                        ...(hasNewDeposit
                          ? [[isStudent ? "Phụ phí doanh nghiệp (mô phỏng)" : "Trong đó phụ phí doanh nghiệp", businessFee] as const]
                          : []),
                        [isStudent ? "Đã giải ngân cho nhóm (mô phỏng)" : "Đã giải ngân cho nhóm", paidOut],
                        [isStudent ? "Phí nền tảng đã ghi nhận (mô phỏng)" : "Tổng phí nền tảng đã ghi nhận", fee],
                        [isStudent ? "Còn trong escrow mô phỏng" : "Còn trong escrow", Math.max(0, deposited - paidOut - fee)],
                      ].map(([label, amount]) => (
                        <div className={isStudent ? "rounded-xl bg-muted/30 p-3" : ""} key={String(label)}>
                          <dt className="text-muted-foreground">{label}</dt>
                          <dd className="mt-1 font-semibold">{formatCurrency(Number(amount))}</dd>
                        </div>
                      ))}
                    </dl>
                  </>
                )}
                <Link
                  className={isStudent
                    ? cn(buttonVariants(), "mt-5 w-full sm:w-auto")
                    : "mt-4 inline-flex rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"}
                  href={`${basePath}/projects/${project.id}`}
                >
                  {transactionDashboard ? "Xem chi tiết giao dịch" : "Mở dự án"}
                  {isStudent && <ArrowRight aria-hidden="true" className="size-4" />}
                </Link>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
