import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatVietnamDateTime, remainingWholeDays } from "@/lib/date-format";

describe("Vietnam date formatting", () => {
  it("formats a date in Asia/Ho_Chi_Minh regardless of server timezone", () => {
    assert.equal(formatVietnamDateTime(new Date("2026-01-01T17:05:00.000Z")), "02/01/2026 00:05");
  });

  it("rounds remaining time down and labels under one day separately", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    assert.equal(remainingWholeDays(new Date("2026-01-02T00:00:01.000Z"), now), 1);
    assert.equal(remainingWholeDays(new Date("2026-01-01T00:00:01.000Z"), now), 0);
    assert.equal(remainingWholeDays(new Date("2025-12-31T00:00:00.000Z"), now), 0);
  });
});
