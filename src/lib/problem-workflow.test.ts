import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getApplicationUnavailableReason,
  getProblemReviewTransition,
  isProblemAcceptingApplications,
  isValidProblemReviewNote,
  PROBLEM_ACCEPTING_APPLICATION_STATUSES,
  PROBLEM_REVIEWABLE_STATUS,
  STUDENT_DISCOVERABLE_PROBLEM_STATUSES,
} from "@/lib/problem-workflow";

describe("Problem review transitions", () => {
  it("allows approval, revision requests, and rejection only while pending review", () => {
    assert.equal(getProblemReviewTransition(PROBLEM_REVIEWABLE_STATUS, "approve"), "APPROVED");
    assert.equal(
      getProblemReviewTransition(PROBLEM_REVIEWABLE_STATUS, "requestRevision"),
      "NEEDS_REVISION",
    );
    assert.equal(getProblemReviewTransition(PROBLEM_REVIEWABLE_STATUS, "reject"), "REJECTED");
    assert.equal(getProblemReviewTransition(PROBLEM_REVIEWABLE_STATUS, "unknown"), null);
    assert.equal(getProblemReviewTransition("REJECTED", "reject"), null);
    assert.equal(getProblemReviewTransition("CLOSED", "reject"), null);
    assert.equal(getProblemReviewTransition("APPROVED", "reject"), null);
  });

  it("requires a trimmed moderation note between 3 and 2,000 characters", () => {
    assert.equal(isValidProblemReviewNote("  Lý do hợp lệ  "), true);
    assert.equal(isValidProblemReviewNote("  "), false);
    assert.equal(isValidProblemReviewNote("ab"), false);
    assert.equal(isValidProblemReviewNote("x".repeat(2001)), false);
  });

  it("keeps rejection separate from a Prototype that ended without implementation", () => {
    assert.match(
      getApplicationUnavailableReason("REJECTED", "Thiếu thông tin"),
      /bị từ chối kiểm duyệt.*Lý do: Thiếu thông tin/,
    );
    assert.match(
      getApplicationUnavailableReason("CLOSED", null),
      /kết thúc sau giai đoạn Prototype/,
    );
    assert.doesNotMatch(
      getApplicationUnavailableReason("CLOSED", null),
      /từ chối kiểm duyệt/,
    );
    assert.doesNotMatch(
      getApplicationUnavailableReason("REJECTED", null),
      /kết thúc sau giai đoạn Prototype/,
    );
  });

  it("excludes rejected and closed Problems from discovery and application", () => {
    assert.deepEqual(PROBLEM_ACCEPTING_APPLICATION_STATUSES, ["APPROVED"]);
    assert.equal(isProblemAcceptingApplications("APPROVED"), true);
    assert.equal(isProblemAcceptingApplications("REJECTED"), false);
    assert.equal(isProblemAcceptingApplications("CLOSED"), false);
    assert.deepEqual(STUDENT_DISCOVERABLE_PROBLEM_STATUSES, [
      "APPROVED",
      "PUBLISHED",
      "TEAM_SELECTED",
      "PROTOTYPING",
      "EVALUATING",
    ]);
  });
});
