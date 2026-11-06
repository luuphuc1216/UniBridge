import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isBusinessLogoUrl,
  isBusinessWebsiteUrl,
} from "@/lib/business-profile-validation";
import {
  getApplicationUnavailableReason,
  isProblemAcceptingApplications,
} from "@/lib/problem-workflow";
import { getUnreadMessageCount } from "@/lib/workspace-message-scope";

describe("Đợt 5B business profile validation", () => {
  it("only accepts HTTPS logo URLs and HTTP/HTTPS websites", () => {
    assert.equal(isBusinessLogoUrl("https://cdn.example.com/logo.png"), true);
    assert.equal(isBusinessLogoUrl("http://cdn.example.com/logo.png"), false);
    assert.equal(isBusinessLogoUrl("javascript:alert(1)"), false);
    assert.equal(isBusinessLogoUrl("data:image/png;base64,abc"), false);
    assert.equal(isBusinessWebsiteUrl("http://example.com"), true);
    assert.equal(isBusinessWebsiteUrl("https://example.com"), true);
    assert.equal(isBusinessWebsiteUrl("ftp://example.com"), false);
  });
});

describe("Đợt 5B closed business problems", () => {
  it("explains business closure without changing legacy CLOSED behavior", () => {
    assert.match(
      getApplicationUnavailableReason("CLOSED", null, "BUSINESS_CLOSED"),
      /doanh nghiệp đóng/,
    );
    assert.match(
      getApplicationUnavailableReason("CLOSED", null, null),
      /kết thúc sau giai đoạn Prototype/,
    );
    assert.equal(isProblemAcceptingApplications("CLOSED"), false);
  });
});

describe("Đợt 5B unread messages", () => {
  it("counts only messages from other people after the reader cursor", () => {
    const now = new Date("2026-11-06T10:00:00.000Z");
    assert.equal(
      getUnreadMessageCount(
        [
          { senderId: "reader", createdAt: new Date("2026-11-06T10:01:00.000Z") },
          { senderId: "other", createdAt: new Date("2026-11-06T10:02:00.000Z") },
          { senderId: "other", createdAt: new Date("2026-11-06T09:59:00.000Z") },
        ],
        "reader",
        now,
      ),
      1,
    );
  });
});
