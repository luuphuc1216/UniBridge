import Link from "next/link";

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
  return (
    <main className="mx-auto max-w-5xl px-4 py-7 sm:px-6 sm:py-10">
      <p className="text-sm font-semibold text-primary">
        {role === "BUSINESS" ? "Khu vực doanh nghiệp" : "Khu vực sinh viên"}
      </p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
        {transactionDashboard ? "Tổng quan giao dịch" : "Dự án triển khai có phí"}
      </h1>
      <aside className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-950">
        Thanh toán giả lập, không phát sinh giao dịch thật.
      </aside>
      {projects.length === 0 ? (
        <section className="mt-6 rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <p className="font-semibold">Chưa có dự án triển khai có phí.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Dự án sẽ xuất hiện tại đây sau khi doanh nghiệp gửi thỏa thuận.
          </p>
        </section>
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
              <article className="rounded-2xl border border-border bg-card p-5 sm:p-6" key={project.id}>
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <h2 className="mt-1 text-lg font-semibold">{project.title}</h2>
                  </div>
                  <span className="w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    {labels[project.status] ?? project.status}
                  </span>
                </div>
                <p className="mt-3 text-sm">
                  Giá trị dự án: <strong>{formatCurrency(project.totalAmount)}</strong>
                </p>
                {transactionDashboard && (
                  <>
                    {hasLegacyDeposit && (
                      <p className="mt-2 text-xs font-semibold text-amber-800">
                        Áp dụng phí nền tảng theo luồng cũ
                      </p>
                    )}
                    <dl className="mt-4 grid gap-3 border-t border-border pt-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                      {[
                        ["Tổng đã nạp", deposited],
                        ...(hasNewDeposit
                          ? [["Trong đó phụ phí doanh nghiệp", businessFee] as const]
                          : []),
                        ["Đã giải ngân cho nhóm", paidOut],
                        ["Tổng phí nền tảng đã ghi nhận", fee],
                        ["Còn trong escrow", Math.max(0, deposited - paidOut - fee)],
                      ].map(([label, amount]) => (
                        <div key={String(label)}>
                          <dt className="text-muted-foreground">{label}</dt>
                          <dd className="mt-1 font-semibold">{formatCurrency(Number(amount))}</dd>
                        </div>
                      ))}
                    </dl>
                  </>
                )}
                <Link
                  className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
                  href={`${basePath}/projects/${project.id}`}
                >
                  {transactionDashboard ? "Xem chi tiết giao dịch" : "Mở dự án"}
                </Link>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
