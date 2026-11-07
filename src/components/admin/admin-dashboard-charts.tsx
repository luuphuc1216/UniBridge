"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const chartColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

type Trend = {
  label: string;
  current: number;
  previous: number;
  trend: { label: string; direction: "up" | "down" | "same"; percentage: number | null };
};

type DashboardChartProps = {
  trends: Trend[];
  weeklyActivity: {
    hasData: boolean;
    values: { label: string; problems: number; applications: number }[];
  };
  monthlyRevenue: {
    hasData: boolean;
    values: { label: string; deposit: number; revenue: number }[];
  };
  projectStatuses: { label: string; value: number }[];
  revenueBreakdown: { label: string; value: number }[];
};

function ChartPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
      <h2 className="text-base font-bold tracking-tight sm:text-lg">{title}</h2>
      <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>
      {children}
    </section>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <p className="mt-4 flex min-h-56 items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 px-4 text-center text-sm text-muted-foreground">
      Chưa có dữ liệu {label}.
    </p>
  );
}

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

function ChartTooltip({
  active,
  payload,
  label,
  currency = false,
}: {
  active?: boolean;
  payload?: { color?: string; name?: string; value?: number | string }[];
  label?: string;
  currency?: boolean;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover p-3 text-sm text-popover-foreground shadow-md">
      {label && <p className="mb-1 font-semibold">{label}</p>}
      {payload.map((item, index) => (
        <p className="flex items-start gap-2 break-words" key={`${item.name ?? "series"}-${index}`}>
          <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
          <span>
            {item.name}:{" "}
            {currency
              ? formatCurrency(Number(item.value ?? 0))
              : Number(item.value ?? 0).toLocaleString("vi-VN")}
          </span>
        </p>
      ))}
    </div>
  );
}

export function AdminDashboardCharts({
  trends,
  weeklyActivity,
  monthlyRevenue,
  projectStatuses,
  revenueBreakdown,
}: DashboardChartProps) {
  const projectTotal = projectStatuses.reduce((total, item) => total + item.value, 0);
  const revenueTotal = revenueBreakdown.reduce((total, item) => total + item.value, 0);

  return (
    <div className="mt-8 space-y-8">
      <section aria-labelledby="admin-trends-heading">
        <div className="mb-4">
          <p className="text-sm font-semibold text-primary">Hoạt động</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight" id="admin-trends-heading">
            Xu hướng 30 ngày
          </h2>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
        {trends.map((item) => (
          <article className="min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm" key={item.label}>
            <p className="text-sm text-muted-foreground">{item.label} · 30 ngày</p>
            <p className="mt-3 break-words text-2xl font-bold tracking-tight sm:text-3xl">
              {item.current.toLocaleString("vi-VN")}
            </p>
            <div className="mt-3 flex items-start gap-2 text-sm">
              <span
                aria-hidden="true"
                className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${
                  item.trend.direction === "up"
                    ? "bg-success/10 text-success"
                    : item.trend.direction === "down"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {item.trend.direction === "up" ? "↑" : item.trend.direction === "down" ? "↓" : "→"}
              </span>
              <p className="min-w-0 text-muted-foreground">
                <span className="font-semibold text-foreground">{item.trend.label}</span>
                {" "}so với 30 ngày trước ({item.previous.toLocaleString("vi-VN")})
              </p>
            </div>
          </article>
        ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartPanel
          description="Số lượng theo từng tuần trong 8 tuần gần nhất."
          title="Problem đăng mới và hồ sơ gửi theo tuần"
        >
          {!weeklyActivity.hasData ? (
            <EmptyChart label="hoạt động theo tuần" />
          ) : (
            <>
              <div aria-label="Chú giải biểu đồ" className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                <span className="flex items-center gap-2">
                  <span aria-hidden="true" className="size-3 rounded-sm" style={{ backgroundColor: chartColors[0] }} />
                  Problem đăng mới
                </span>
                <span className="flex items-center gap-2">
                  <span aria-hidden="true" className="size-3 rounded-sm" style={{ backgroundColor: chartColors[2] }} />
                  Hồ sơ ứng tuyển
                </span>
              </div>
              <div className="mt-3 h-64 min-w-0 w-full sm:h-72">
                <ResponsiveContainer height="100%" width="100%">
                  <BarChart accessibilityLayer data={weeklyActivity.values} margin={{ top: 12, right: 8, bottom: 8, left: -18 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="label"
                      interval="preserveStartEnd"
                      minTickGap={8}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                      tickMargin={8}
                    />
                    <YAxis allowDecimals={false} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} width={34} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="problems" fill={chartColors[0]} isAnimationActive={false} name="Problem đăng mới" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="applications" fill={chartColors[2]} isAnimationActive={false} name="Hồ sơ ứng tuyển" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-3 grid gap-x-4 gap-y-2 border-t border-border pt-3 text-xs leading-5 text-muted-foreground sm:grid-cols-2" aria-label="Số liệu hoạt động từng tuần">
                {weeklyActivity.values.map((item) => (
                  <li key={item.label}>
                    {item.label}: Problem {item.problems.toLocaleString("vi-VN")} · Hồ sơ {item.applications.toLocaleString("vi-VN")}
                  </li>
                ))}
              </ul>
            </>
          )}
        </ChartPanel>

        <ChartPanel
          description="Phân bổ theo các nhóm phí và dịch vụ hiện có."
          title="Cơ cấu doanh thu nền tảng"
        >
          {revenueTotal === 0 ? (
            <EmptyChart label="cơ cấu doanh thu" />
          ) : (
            <>
              <div className="relative mt-3 h-56 min-w-0 w-full">
                <ResponsiveContainer height="100%" width="100%">
                  <PieChart accessibilityLayer>
                    <Pie
                      data={revenueBreakdown}
                      dataKey="value"
                      innerRadius="58%"
                      isAnimationActive={false}
                      nameKey="label"
                      outerRadius="82%"
                      paddingAngle={2}
                    >
                      {revenueBreakdown.map((item, index) => (
                        <Cell fill={chartColors[index % chartColors.length]} key={item.label} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip currency />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xs text-muted-foreground">Tổng doanh thu</span>
                  <strong className="max-w-[9rem] break-words text-center text-xs sm:text-sm">
                    {formatCurrency(revenueTotal)}
                  </strong>
                </div>
              </div>
              <ul className="mt-3 grid gap-2 border-t border-border pt-3 text-sm sm:grid-cols-2" aria-label="Chi tiết các nhóm doanh thu">
                {revenueBreakdown.map((item, index) => (
                  <li className="flex items-start gap-2" key={item.label}>
                    <span
                      aria-hidden="true"
                      className="mt-1 size-3 shrink-0 rounded-sm"
                      style={{ backgroundColor: chartColors[index % chartColors.length] }}
                    />
                    <span>{item.label}: <strong>{formatCurrency(item.value)}</strong></span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </ChartPanel>

        <ChartPanel
          description="Giá trị DEPOSIT và doanh thu được thống kê theo 6 tháng gần nhất."
          title="DEPOSIT và doanh thu nền tảng theo tháng"
        >
          {!monthlyRevenue.hasData ? (
            <EmptyChart label="giao dịch theo tháng" />
          ) : (
            <>
              <div aria-label="Chú giải biểu đồ" className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                <span className="flex items-center gap-2">
                  <span aria-hidden="true" className="size-3 rounded-full" style={{ backgroundColor: chartColors[1] }} />
                  Tổng giá trị DEPOSIT
                </span>
                <span className="flex items-center gap-2">
                  <span aria-hidden="true" className="size-3 rounded-full" style={{ backgroundColor: chartColors[4] }} />
                  Tổng doanh thu nền tảng
                </span>
              </div>
              <div className="mt-3 h-64 min-w-0 w-full sm:h-72">
                <ResponsiveContainer height="100%" width="100%">
                  <LineChart accessibilityLayer data={monthlyRevenue.values} margin={{ top: 12, right: 8, bottom: 8, left: 2 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickMargin={8} />
                    <YAxis
                      tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                      tickFormatter={(value: number) => new Intl.NumberFormat("vi-VN", { notation: "compact" }).format(value)}
                      width={54}
                    />
                    <Tooltip content={<ChartTooltip currency />} />
                    <Line dataKey="deposit" dot={{ r: 3 }} isAnimationActive={false} name="Tổng giá trị DEPOSIT" stroke={chartColors[1]} strokeWidth={2} type="monotone" />
                    <Line dataKey="revenue" dot={{ r: 3 }} isAnimationActive={false} name="Tổng doanh thu nền tảng" stroke={chartColors[4]} strokeWidth={2} type="monotone" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-3 grid gap-x-4 gap-y-2 border-t border-border pt-3 text-xs leading-5 text-muted-foreground sm:grid-cols-2" aria-label="Số liệu giao dịch từng tháng">
                {monthlyRevenue.values.map((item) => (
                  <li key={item.label}>
                    {item.label}: DEPOSIT {formatCurrency(item.deposit)} · Doanh thu {formatCurrency(item.revenue)}
                  </li>
                ))}
              </ul>
            </>
          )}
        </ChartPanel>

        <ChartPanel
          description="Số dự án được nhóm theo trạng thái hiện tại."
          title="Dự án theo trạng thái"
        >
          {projectTotal === 0 ? (
            <EmptyChart label="dự án theo trạng thái" />
          ) : (
            <>
              <div className="mt-4 h-64 min-w-0 w-full sm:h-72">
                <ResponsiveContainer height="100%" width="100%">
                <BarChart accessibilityLayer data={projectStatuses} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis allowDecimals={false} type="number" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
                  <YAxis dataKey="label" type="category" width={110} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="value" fill={chartColors[2]} isAnimationActive={false} name="Số dự án" radius={[0, 4, 4, 0]} />
                </BarChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-3 grid gap-x-4 gap-y-2 border-t border-border pt-3 text-sm sm:grid-cols-2" aria-label="Số dự án theo trạng thái">
                {projectStatuses.map((item) => (
                  <li className="flex items-center justify-between gap-3" key={item.label}>
                    <span className="text-muted-foreground">{item.label}</span>
                    <strong>{item.value.toLocaleString("vi-VN")}</strong>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="mt-3 text-sm font-medium text-foreground">
            Tổng số dự án: {projectTotal.toLocaleString("vi-VN")}
          </p>
        </ChartPanel>
      </div>
    </div>
  );
}
