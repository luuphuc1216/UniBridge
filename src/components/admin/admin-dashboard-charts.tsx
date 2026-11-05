"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
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
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h2 className="text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

function EmptyChart() {
  return (
    <p className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
      Chưa có dữ liệu
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
      {payload.map((item) => (
        <p className="flex items-center gap-2" key={item.name}>
          <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
          <span>{item.name}: {currency ? formatCurrency(Number(item.value ?? 0)) : Number(item.value ?? 0)}</span>
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
    <div className="mt-8 space-y-6">
      <section aria-label="Chỉ số xu hướng 30 ngày" className="grid gap-4 md:grid-cols-3">
        {trends.map((item) => (
          <article className="rounded-2xl border border-border bg-card p-5" key={item.label}>
            <p className="text-sm text-muted-foreground">{item.label} · 30 ngày</p>
            <p className="mt-2 text-2xl font-bold tracking-tight">{item.current.toLocaleString("vi-VN")}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{item.trend.label}</span>
              {" "}so với 30 ngày trước ({item.previous.toLocaleString("vi-VN")})
            </p>
          </article>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartPanel title="Bài toán đăng mới và hồ sơ gửi theo tuần">
          {!weeklyActivity.hasData ? (
            <EmptyChart />
          ) : (
            <>
              <div aria-label="Chú giải" className="mt-3 flex flex-wrap gap-4 text-sm">
                <span className="flex items-center gap-2">
                  <span aria-hidden="true" className="size-3 rounded-sm" style={{ backgroundColor: chartColors[0] }} />
                  Bài toán đăng mới
                </span>
                <span className="flex items-center gap-2">
                  <span aria-hidden="true" className="size-3 rounded-sm" style={{ backgroundColor: chartColors[2] }} />
                  Hồ sơ ứng tuyển
                </span>
              </div>
              <div className="mt-2 h-72 w-full">
                <ResponsiveContainer height="100%" width="100%">
                  <BarChart data={weeklyActivity.values} margin={{ top: 12, right: 12, bottom: 4, left: -18 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="problems" fill={chartColors[0]} name="Bài toán đăng mới" radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="problems" fill="var(--foreground)" position="top" />
                    </Bar>
                    <Bar dataKey="applications" fill={chartColors[2]} name="Hồ sơ ứng tuyển" radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="applications" fill="var(--foreground)" position="top" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-3 grid gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
                {weeklyActivity.values.map((item) => (
                  <li key={item.label}>
                    {item.label}: Bài toán {item.problems} · Hồ sơ {item.applications}
                  </li>
                ))}
              </ul>
            </>
          )}
        </ChartPanel>

        <ChartPanel title="Cơ cấu doanh thu nền tảng">
          {revenueTotal === 0 ? (
            <EmptyChart />
          ) : (
            <>
              <div className="relative mt-2 h-56 w-full">
                <ResponsiveContainer height="100%" width="100%">
                  <PieChart>
                    <Pie
                      data={revenueBreakdown}
                      dataKey="value"
                      innerRadius="58%"
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
                  <strong className="text-center text-sm">{formatCurrency(revenueTotal)}</strong>
                </div>
              </div>
              <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
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

        <ChartPanel title="Khoản đặt cọc mô phỏng và doanh thu nền tảng theo tháng">
          {!monthlyRevenue.hasData ? (
            <EmptyChart />
          ) : (
            <>
              <div aria-label="Chú giải" className="mt-3 flex flex-wrap gap-4 text-sm">
                <span className="flex items-center gap-2">
                  <span aria-hidden="true" className="size-3 rounded-full" style={{ backgroundColor: chartColors[1] }} />
                  Tổng khoản đặt cọc mô phỏng
                </span>
                <span className="flex items-center gap-2">
                  <span aria-hidden="true" className="size-3 rounded-full" style={{ backgroundColor: chartColors[4] }} />
                  Tổng doanh thu nền tảng
                </span>
              </div>
              <div className="mt-2 h-72 w-full">
                <ResponsiveContainer height="100%" width="100%">
                  <LineChart data={monthlyRevenue.values} margin={{ top: 12, right: 18, bottom: 4, left: 8 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                    <YAxis
                      tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                      tickFormatter={(value: number) => new Intl.NumberFormat("vi-VN", { notation: "compact" }).format(value)}
                      width={64}
                    />
                    <Tooltip content={<ChartTooltip currency />} />
                    <Line dataKey="deposit" dot={{ r: 3 }} name="Tổng khoản đặt cọc mô phỏng" stroke={chartColors[1]} strokeWidth={2} type="monotone" />
                    <Line dataKey="revenue" dot={{ r: 3 }} name="Tổng doanh thu nền tảng" stroke={chartColors[4]} strokeWidth={2} type="monotone" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-3 grid gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
                {monthlyRevenue.values.map((item) => (
                  <li key={item.label}>
                    {item.label}: Khoản đặt cọc mô phỏng {formatCurrency(item.deposit)} · Doanh thu {formatCurrency(item.revenue)}
                  </li>
                ))}
              </ul>
            </>
          )}
        </ChartPanel>

        <ChartPanel title="Dự án theo trạng thái">
          {projectTotal === 0 ? (
            <EmptyChart />
          ) : (
            <div className="mt-4 h-72 w-full">
              <ResponsiveContainer height="100%" width="100%">
                <BarChart data={projectStatuses} layout="vertical" margin={{ top: 4, right: 32, bottom: 4, left: 4 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis allowDecimals={false} type="number" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                  <YAxis dataKey="label" type="category" width={104} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="value" fill={chartColors[2]} name="Số dự án" radius={[0, 4, 4, 0]}>
                    <LabelList dataKey="value" fill="var(--foreground)" position="right" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="mt-2 text-sm text-muted-foreground">Tổng số dự án: {projectTotal.toLocaleString("vi-VN")}</p>
        </ChartPanel>
      </div>
    </div>
  );
}
