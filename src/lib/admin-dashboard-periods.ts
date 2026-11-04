const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type DashboardPeriodUnit = "day" | "week" | "month";

export type DashboardPeriod = {
  key: string;
  label: string;
  start: Date;
  end: Date;
};

function getVietnamParts(date: Date) {
  const local = new Date(date.getTime() + VIETNAM_OFFSET_MS);
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth(),
    day: local.getUTCDate(),
    weekday: local.getUTCDay(),
  };
}

function localDateToUtc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day) - VIETNAM_OFFSET_MS);
}

function formatDayKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function periodStartParts(
  year: number,
  month: number,
  day: number,
  unit: DashboardPeriodUnit,
) {
  const normalized = new Date(Date.UTC(year, month, day));
  if (unit === "month") {
    return {
      year: normalized.getUTCFullYear(),
      month: normalized.getUTCMonth(),
      day: 1,
    };
  }
  if (unit === "week") {
    const weekday = normalized.getUTCDay();
    normalized.setUTCDate(normalized.getUTCDate() - ((weekday + 6) % 7));
  }
  return {
    year: normalized.getUTCFullYear(),
    month: normalized.getUTCMonth(),
    day: normalized.getUTCDate(),
  };
}

function nextPeriodParts(
  year: number,
  month: number,
  day: number,
  unit: DashboardPeriodUnit,
) {
  const next = new Date(Date.UTC(year, month, day));
  if (unit === "month") next.setUTCMonth(next.getUTCMonth() + 1);
  else if (unit === "week") next.setUTCDate(next.getUTCDate() + 7);
  else next.setUTCDate(next.getUTCDate() + 1);
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth(),
    day: next.getUTCDate(),
  };
}

function formatPeriodLabel(
  start: { year: number; month: number; day: number },
  unit: DashboardPeriodUnit,
): string {
  if (unit === "month") {
    return new Intl.DateTimeFormat("vi-VN", {
      month: "short",
      year: "numeric",
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(localDateToUtc(start.year, start.month, start.day));
  }
  const label = new Intl.DateTimeFormat("vi-VN", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(localDateToUtc(start.year, start.month, start.day));
  return unit === "week" ? `Tuần từ ${label}` : label;
}

export function getRecentDashboardPeriods(
  now: Date,
  unit: DashboardPeriodUnit,
  count: number,
): DashboardPeriod[] {
  const local = getVietnamParts(now);
  const latest = periodStartParts(local.year, local.month, local.day, unit);
  const periods: DashboardPeriod[] = [];

  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const startDate = new Date(Date.UTC(latest.year, latest.month, latest.day));
    if (unit === "month") startDate.setUTCMonth(startDate.getUTCMonth() - offset);
    else if (unit === "week") startDate.setUTCDate(startDate.getUTCDate() - offset * 7);
    else startDate.setUTCDate(startDate.getUTCDate() - offset);

    const start = {
      year: startDate.getUTCFullYear(),
      month: startDate.getUTCMonth(),
      day: startDate.getUTCDate(),
    };
    const end = nextPeriodParts(start.year, start.month, start.day, unit);
    const key =
      unit === "month"
        ? `${start.year}-${String(start.month + 1).padStart(2, "0")}`
        : formatDayKey(start.year, start.month, start.day);
    periods.push({
      key,
      label: formatPeriodLabel(start, unit),
      start: localDateToUtc(start.year, start.month, start.day),
      end: localDateToUtc(end.year, end.month, end.day),
    });
  }

  return periods;
}

export function getRecentThirtyDayWindows(now: Date) {
  const local = getVietnamParts(now);
  const todayStart = localDateToUtc(local.year, local.month, local.day);
  const currentStart = new Date(todayStart.getTime() - 29 * DAY_MS);
  const previousStart = new Date(todayStart.getTime() - 59 * DAY_MS);
  const tomorrow = new Date(todayStart.getTime() + DAY_MS);
  return {
    previous: { start: previousStart, end: currentStart },
    current: { start: currentStart, end: tomorrow },
  };
}

export function getDashboardTrend(current: number, previous: number) {
  if (previous === 0) {
    return {
      label: current === 0 ? "0" : "Mới",
      direction: current === 0 ? "same" : "up",
      percentage: null,
    } as const;
  }

  const percentage = ((current - previous) / previous) * 100;
  return {
    label: `${percentage > 0 ? "+" : ""}${Number(percentage.toFixed(1))}%`,
    direction: percentage > 0 ? "up" : percentage < 0 ? "down" : "same",
    percentage,
  } as const;
}

export function findDashboardPeriodIndex(
  periods: DashboardPeriod[],
  date: Date,
): number {
  return periods.findIndex((period) => date >= period.start && date < period.end);
}
