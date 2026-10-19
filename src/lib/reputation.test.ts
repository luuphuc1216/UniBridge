import assert from "node:assert/strict";
import test from "node:test";
import { calculateTeamReputation } from "@/lib/reputation";

test("không có dự án hoặc đánh giá thì chưa tạo điểm Reputation", () => {
  const reputation = calculateTeamReputation({
    reviews: [],
    projects: [],
    transactionCount: 0,
  });

  assert.equal(reputation.ratingAverage, null);
  assert.equal(reputation.smoothedRatingAverage, 3);
  assert.equal(reputation.ratingCount, 0);
  assert.equal(reputation.completionRate, null);
  assert.equal(reputation.onTimeRate, null);
  assert.equal(reputation.score, null);
});

test("một đánh giá 5 sao được làm mượt và không vượt nhóm có 20 đánh giá trung bình 4.8", () => {
  const oneReview = calculateTeamReputation({
    reviews: [{ rating: 5 }],
    projects: [],
    transactionCount: 0,
  });
  const manyReviews = calculateTeamReputation({
    reviews: Array.from({ length: 20 }, () => ({ rating: 4.8 })),
    projects: [],
    transactionCount: 0,
  });

  assert.equal(oneReview.smoothedRatingAverage, 3.3);
  assert.ok(oneReview.smoothedRatingAverage < manyReviews.smoothedRatingAverage);
  assert.ok(oneReview.score !== null && manyReviews.score !== null);
  assert.ok(oneReview.score < manyReviews.score);
});

test("tỷ lệ hoàn thành chỉ tính Project COMPLETED và CANCELLED có nạp tiền", () => {
  const reputation = calculateTeamReputation({
    reviews: [],
    projects: [
      { status: "COMPLETED", hasPaidDeposit: true, milestones: [] },
      { status: "CANCELLED", hasPaidDeposit: true, milestones: [] },
      { status: "CANCELLED", hasPaidDeposit: false, milestones: [] },
      { status: "IN_PROGRESS", hasPaidDeposit: true, milestones: [] },
      { status: "CLOSED", hasPaidDeposit: false, milestones: [] },
    ],
    transactionCount: 2,
  });

  assert.equal(reputation.completedProjectCount, 1);
  assert.equal(reputation.fundedCancelledProjectCount, 1);
  assert.equal(reputation.eligibleProjectCount, 2);
  assert.equal(reputation.completionRate, 50);
});

test("tỷ lệ đúng hạn so thời điểm nghiệm thu hoặc nộp với dueAt", () => {
  const dueAt = new Date("2026-01-10T00:00:00.000Z");
  const reputation = calculateTeamReputation({
    reviews: [{ rating: 4 }],
    projects: [
      {
        status: "COMPLETED",
        hasPaidDeposit: true,
        milestones: [
          {
            dueAt,
            acceptedAt: new Date("2026-01-09T00:00:00.000Z"),
            submittedAt: new Date("2026-01-08T00:00:00.000Z"),
          },
          {
            dueAt,
            acceptedAt: new Date("2026-01-11T00:00:00.000Z"),
            submittedAt: new Date("2026-01-10T00:00:00.000Z"),
          },
          { dueAt: null, acceptedAt: null, submittedAt: null },
        ],
      },
    ],
    transactionCount: 1,
  });

  assert.equal(reputation.onTimeMilestoneCount, 1);
  assert.equal(reputation.eligibleMilestoneCount, 2);
  assert.equal(reputation.onTimeRate, 50);
});
