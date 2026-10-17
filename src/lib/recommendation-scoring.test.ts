import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  scoreRecommendation,
  selectRecommendations,
  sortRecommendations,
  type RecommendationProfile,
  type RecommendationProblem,
} from "@/lib/recommendation-scoring";

function createProfile(
  overrides: Partial<RecommendationProfile> = {},
): RecommendationProfile {
  return {
    majors: [],
    skills: [],
    interests: [],
    viewedProblems: [],
    savedProblems: [],
    searchedFields: [],
    searchedSkills: [],
    searchQueries: [],
    appliedProblems: [],
    ratingAverage: 0,
    ratingCount: 0,
    ...overrides,
  };
}

function createProblem(
  overrides: Partial<RecommendationProblem> = {},
): RecommendationProblem {
  return {
    id: "problem-1",
    title: "Phân tích dữ liệu khách hàng",
    field: "Phân tích dữ liệu",
    skills: ["Python", "SQL"],
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("scoreRecommendation", () => {
  it("scores profile matches and returns no more than three strongest reasons", () => {
    const result = scoreRecommendation(
      createProblem(),
      createProfile({
        majors: ["Khoa học dữ liệu", "Phân tích dữ liệu"],
        skills: ["Python", "SQL"],
        interests: ["Phân tích dữ liệu"],
        savedProblems: [{ field: "Phân tích dữ liệu", skills: ["Python"] }],
      }),
    );

    assert.ok(result.score > 0);
    assert.equal(result.reasons.length, 3);
    assert.ok(result.reasons.includes("Trùng kỹ năng: Python, SQL"));
    assert.ok(result.reasons.includes("Trùng chuyên ngành: Phân tích dữ liệu"));
  });

  it("reduces the reputation boost when a team has few ratings", () => {
    const problem = createProblem();
    const oneRating = scoreRecommendation(
      problem,
      createProfile({ ratingAverage: 5, ratingCount: 1 }),
    );
    const enoughRatings = scoreRecommendation(
      problem,
      createProfile({ ratingAverage: 5, ratingCount: 5 }),
    );

    assert.equal(oneRating.score, 1.6);
    assert.equal(enoughRatings.score, 8);
  });

  it("uses views, saved problems, searches and applications as independent signals", () => {
    const result = scoreRecommendation(
      createProblem(),
      createProfile({
        viewedProblems: [{ field: "Phân tích dữ liệu", skills: [] }],
        savedProblems: [{ field: "Thiết kế", skills: ["SQL"] }],
        searchedSkills: ["Python"],
        appliedProblems: [{ field: "Phân tích dữ liệu", skills: [] }],
      }),
    );

    assert.equal(result.score, 7 + 7 + 8 + 8);
    assert.deepEqual(result.reasons, [
      "Bạn từng tìm kỹ năng: Python",
      "Bạn từng gửi hồ sơ cho bài cùng lĩnh vực",
      "Bạn đã xem bài cùng lĩnh vực",
    ]);
  });

  it("breaks equal scores by newest problem first", () => {
    const older = scoreRecommendation(
      createProblem({ id: "older", createdAt: new Date("2026-10-01T00:00:00.000Z") }),
      createProfile({ skills: ["Python"] }),
    );
    const newer = scoreRecommendation(
      createProblem({ id: "newer", createdAt: new Date("2026-10-02T00:00:00.000Z") }),
      createProfile({ skills: ["Python"] }),
    );

    assert.deepEqual(
      sortRecommendations([older, newer]).map(({ problem }) => problem.id),
      ["newer", "older"],
    );
  });

  it("falls back to newest problems when none reaches the minimum score", () => {
    const older = scoreRecommendation(
      createProblem({ id: "older", createdAt: new Date("2026-10-01T00:00:00.000Z") }),
      createProfile({ skills: ["Python"], ratingAverage: 5, ratingCount: 3 }),
    );
    const newer = scoreRecommendation(
      createProblem({ id: "newer", createdAt: new Date("2026-10-02T00:00:00.000Z") }),
      createProfile(),
    );

    const selection = selectRecommendations([older, newer]);

    assert.equal(selection.usedFallback, true);
    assert.deepEqual(
      selection.recommendations.map(({ problem }) => problem.id),
      ["newer", "older"],
    );
  });
});
