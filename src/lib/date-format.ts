const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";

const vietnamDateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  timeZone: VIETNAM_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function formatVietnamDateTime(date: Date, timeFirst = false): string {
  const parts = vietnamDateTimeFormatter.formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const datePart = `${values.day}/${values.month}/${values.year}`;
  const timePart = `${values.hour}:${values.minute}`;
  return timeFirst ? `${timePart} ngày ${datePart}` : `${datePart} ${timePart}`;
}

export function remainingWholeDays(date: Date, now: Date): number {
  return Math.max(0, Math.floor((date.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
}
