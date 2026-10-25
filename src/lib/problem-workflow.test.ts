import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  APPLICATION_EFFECTIVE_STATUSES,
  canCreatePendingInvitation,
  canEditApplication,
  getEffectiveApplicationStatuses,
  getApplicationUnavailableReason,
  getProblemReviewTransition,
  isEffectiveApplicationStatus,
  isProblemAcceptingApplications,
  isValidProblemReviewNote,
  PROBLEM_ACCEPTING_APPLICATION_STATUSES,
  PROBLEM_REVIEWABLE_STATUS,
  STUDENT_DISCOVERABLE_PROBLEM_STATUSES,
  shouldExpireInvitation,
  shouldSendInvitationReminder,
  isWorkspaceMessageWritableApplicationStatus,
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
    assert.deepEqual(PROBLEM_ACCEPTING_APPLICATION_STATUSES, ["APPROVED", "PUBLISHED"]);
    assert.equal(isProblemAcceptingApplications("APPROVED"), true);
    assert.equal(isProblemAcceptingApplications("PUBLISHED"), true);
    assert.equal(isProblemAcceptingApplications("REJECTED"), false);
    assert.equal(isProblemAcceptingApplications("CLOSED"), false);
    assert.equal(isEffectiveApplicationStatus("PENDING_CONFIRMATION"), true);
    assert.equal(isEffectiveApplicationStatus("DECLINED"), false);
    assert.deepEqual(APPLICATION_EFFECTIVE_STATUSES, ["SUBMITTED", "PENDING_CONFIRMATION", "SELECTED"]);
    assert.deepEqual(STUDENT_DISCOVERABLE_PROBLEM_STATUSES, [
      "APPROVED",
      "PUBLISHED",
      "TEAM_SELECTED",
      "PROTOTYPING",
      "EVALUATING",
    ]);
  });

  it("uses one effective-profile rule across application surfaces", () => {
    assert.equal(isEffectiveApplicationStatus("SUBMITTED"), true);
    assert.equal(isEffectiveApplicationStatus("PENDING_CONFIRMATION"), true);
    assert.equal(isEffectiveApplicationStatus("SELECTED"), true);
    assert.deepEqual(getEffectiveApplicationStatuses(), [
      "SUBMITTED",
      "PENDING_CONFIRMATION",
      "SELECTED",
    ]);
    for (const status of ["WITHDRAWN", "DECLINED", "EXPIRED", "NOT_SELECTED"]) {
      assert.equal(isEffectiveApplicationStatus(status), false);
    }
  });

  it("locks snapshots once an application leaves SUBMITTED", () => {
    assert.equal(canEditApplication(null), true);
    assert.equal(canEditApplication("SUBMITTED"), true);
    assert.equal(canEditApplication("PENDING_CONFIRMATION"), false);
    assert.equal(canEditApplication("SELECTED"), false);
    assert.equal(canEditApplication("WITHDRAWN"), false);
  });

  it("allows only one pending invitation and handles expiry at the deadline", () => {
    assert.equal(canCreatePendingInvitation(0), true);
    assert.equal(canCreatePendingInvitation(1), false);
    const now = new Date("2026-10-23T00:00:00.000Z");
    assert.equal(shouldExpireInvitation("PENDING_CONFIRMATION", now, now), true);
    assert.equal(
      shouldExpireInvitation("PENDING_CONFIRMATION", new Date(now.getTime() + 1), now),
      false,
    );
    assert.equal(shouldExpireInvitation("DECLINED", now, now), false);
  });

  it("does not duplicate day-three reminders", () => {
    const now = new Date("2026-10-23T00:00:00.000Z");
    const reminderAt = new Date(now.getTime() - 1);
    assert.equal(shouldSendInvitationReminder("PENDING_CONFIRMATION", reminderAt, null, now), true);
    assert.equal(
      shouldSendInvitationReminder("PENDING_CONFIRMATION", reminderAt, now, now),
      false,
    );
    assert.equal(shouldSendInvitationReminder("EXPIRED", reminderAt, null, now), false);
  });

  it("allows workspace messages only for pending or selected applications", () => {
    assert.equal(isWorkspaceMessageWritableApplicationStatus("PENDING_CONFIRMATION"), true);
    assert.equal(isWorkspaceMessageWritableApplicationStatus("SELECTED"), true);
    assert.equal(isWorkspaceMessageWritableApplicationStatus("DECLINED"), false);
    assert.equal(isWorkspaceMessageWritableApplicationStatus("EXPIRED"), false);
    assert.equal(isWorkspaceMessageWritableApplicationStatus("NOT_SELECTED"), false);
  });
});
