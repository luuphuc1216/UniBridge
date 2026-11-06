import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isBusinessLogoUrl,
  isBusinessWebsiteUrl,
} from "@/lib/business-profile-validation";
import {
  getBusinessCloseBlockReason,
  getApplicationUnavailableReason,
  isProblemAcceptingApplications,
} from "@/lib/problem-workflow";
import { sortByRecommendationScore } from "@/lib/recommendation-scoring";
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
    assert.match(
      getBusinessCloseBlockReason({ hasPendingInvitation: true, hasSelectedApplication: false, hasRunningProject: false }) ?? "",
      /lời mời/,
    );
    assert.match(
      getBusinessCloseBlockReason({ hasPendingInvitation: false, hasSelectedApplication: true, hasRunningProject: false }) ?? "",
      /đã có nhóm/,
    );
    assert.equal(
      getBusinessCloseBlockReason({ hasPendingInvitation: false, hasSelectedApplication: false, hasRunningProject: false }),
      null,
    );
  });
});

describe("Đợt 5B recommendation sorting", () => {
  it("orders filtered problems by the existing recommendation score", () => {
    const items = [
      { id: "new", createdAt: new Date("2026-11-06") },
      { id: "best", createdAt: new Date("2026-11-01") },
      { id: "same", createdAt: new Date("2026-11-05") },
    ];
    assert.deepEqual(
      sortByRecommendationScore(items, { best: 90, same: 20, new: 20 }).map(({ id }) => id),
      ["best", "new", "same"],
    );
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
