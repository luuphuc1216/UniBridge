import { recommendationConfig } from "@/lib/recommendation-config";

export type RecommendationHistoryProblem = {
  field: string;
  skills: string[];
};

export type RecommendationProfile = {
  majors: string[];
  skills: string[];
  interests: string[];
  viewedProblems: RecommendationHistoryProblem[];
  savedProblems: RecommendationHistoryProblem[];
  searchedFields: string[];
  searchedSkills: string[];
  searchQueries: string[];
  appliedProblems: RecommendationHistoryProblem[];
  ratingAverage: number;
  ratingCount: number;
};

export type RecommendationProblem = {
  id: string;
  title: string;
  field: string;
  skills: string[];
  createdAt: Date;
};

export type ScoredRecommendation<T extends RecommendationProblem = RecommendationProblem> = {
  problem: T;
  score: number;
  reasons: string[];
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/gi, "d")
    .toLocaleLowerCase("vi")
    .trim();
}

function matchesText(left: string, right: string): boolean {
  const normalizedLeft = normalize(left);
  const normalizedRight = normalize(right);
  return Boolean(
    normalizedLeft &&
      normalizedRight &&
      (normalizedLeft === normalizedRight ||
        normalizedLeft.includes(normalizedRight) ||
        normalizedRight.includes(normalizedLeft)),
  );
}

function matchingSkills(profileSkills: string[], problemSkills: string[]): string[] {
  const normalizedProfileSkills = new Set(profileSkills.map(normalize));
  return problemSkills.filter((skill) => normalizedProfileSkills.has(normalize(skill)));
}

function getHistoryMatch(
  history: RecommendationHistoryProblem[],
  problem: RecommendationProblem,
): "field" | "skill" | null {
  for (const item of history) {
    if (matchesText(item.field, problem.field)) return "field";
    if (matchingSkills(item.skills, problem.skills).length > 0) return "skill";
  }
  return null;
}

export function scoreRecommendation(
  problem: RecommendationProblem,
  profile: RecommendationProfile,
): ScoredRecommendation {
  const reasonScores: { reason: string; score: number }[] = [];
  const matchedMajors = profile.majors.filter((major) => matchesText(major, problem.field));
  const matchedSkills = matchingSkills(profile.skills, problem.skills);
  const matchedInterests = profile.interests.filter(
    (interest) =>
      matchesText(interest, problem.field) ||
      problem.skills.some((skill) => matchesText(interest, skill)),
  );

  if (matchedMajors.length > 0) {
    reasonScores.push({
      reason: `Trùng chuyên ngành: ${matchedMajors.slice(0, 2).join(", ")}`,
      score: recommendationConfig.points.majorMatch,
    });
  }
  if (matchedSkills.length > 0) {
    reasonScores.push({
      reason: `Trùng kỹ năng: ${matchedSkills.slice(0, 3).join(", ")}`,
      score:
        recommendationConfig.points.skillMatch *
        Math.min(matchedSkills.length, recommendationConfig.maxSkillMatches),
    });
  }
  if (matchedInterests.length > 0) {
    reasonScores.push({
      reason: `Trùng lĩnh vực quan tâm: ${matchedInterests.slice(0, 2).join(", ")}`,
      score: recommendationConfig.points.interestMatch,
    });
  }

  const viewMatch = getHistoryMatch(profile.viewedProblems, problem);
  if (viewMatch) {
    reasonScores.push({
      reason:
        viewMatch === "field"
          ? "Bạn đã xem bài cùng lĩnh vực"
          : "Bạn đã xem bài có kỹ năng liên quan",
      score:
        viewMatch === "field"
          ? recommendationConfig.points.viewedFieldMatch
          : recommendationConfig.points.viewedSkillMatch,
    });
  }

  const savedMatch = getHistoryMatch(profile.savedProblems, problem);
  if (savedMatch) {
    reasonScores.push({
      reason:
        savedMatch === "field"
          ? "Bạn đã lưu bài cùng lĩnh vực"
          : "Bạn đã lưu bài có kỹ năng liên quan",
      score:
        savedMatch === "field"
          ? recommendationConfig.points.savedFieldMatch
          : recommendationConfig.points.savedSkillMatch,
    });
  }

  if (profile.searchedFields.some((field) => matchesText(field, problem.field))) {
    reasonScores.push({
      reason: "Bạn từng tìm kiếm lĩnh vực này",
      score: recommendationConfig.points.searchedFieldMatch,
    });
  } else if (
    profile.searchedSkills.some((skill) =>
      problem.skills.some((problemSkill) => matchesText(skill, problemSkill)),
    )
  ) {
    reasonScores.push({
      reason: `Bạn từng tìm kỹ năng: ${
        profile.searchedSkills.find((skill) =>
          problem.skills.some((problemSkill) => matchesText(skill, problemSkill)),
        ) ?? ""
      }`,
      score: recommendationConfig.points.searchedSkillMatch,
    });
  } else {
    const matchingQuery = profile.searchQueries.find((query) =>
      [problem.title, problem.field, ...problem.skills].some((text) =>
        matchesText(query, text),
      ),
    );
    if (matchingQuery) {
      reasonScores.push({
        reason: `Khớp với tìm kiếm gần đây: ${matchingQuery}`,
        score: recommendationConfig.points.searchedQueryMatch,
      });
    }
  }

  const applicationMatch = getHistoryMatch(profile.appliedProblems, problem);
  if (applicationMatch) {
    reasonScores.push({
      reason:
        applicationMatch === "field"
          ? "Bạn từng gửi hồ sơ cho bài cùng lĩnh vực"
          : "Bạn từng gửi hồ sơ cho bài có kỹ năng liên quan",
      score:
        applicationMatch === "field"
          ? recommendationConfig.points.appliedFieldMatch
          : recommendationConfig.points.appliedSkillMatch,
    });
  }

  const countMultiplier = Math.min(
    Math.max(profile.ratingCount, 0) / recommendationConfig.reputation.fullWeightRatingCount,
    1,
  );
  const normalizedRating = Math.min(
    Math.max(profile.ratingAverage, 0),
    recommendationConfig.reputation.maxRating,
  );
  const reputationScore =
    (normalizedRating / recommendationConfig.reputation.maxRating) *
    recommendationConfig.reputation.maxPoints *
    countMultiplier;
  if (reputationScore > 0) {
    reasonScores.push({
      reason: `Uy tín nhóm: ${normalizedRating.toFixed(1)}/5 (${profile.ratingCount} lượt đánh giá)`,
      score: reputationScore,
    });
  }

  const sortedReasons = reasonScores.sort((left, right) => right.score - left.score);
  return {
    problem,
    score: reasonScores.reduce((total, item) => total + item.score, 0),
    reasons: sortedReasons.slice(0, recommendationConfig.maxReasons).map(({ reason }) => reason),
  };
}

export function sortRecommendations<T extends ScoredRecommendation>(
  recommendations: T[],
): T[] {
  return [...recommendations].sort(
    (left, right) =>
      right.score - left.score ||
      right.problem.createdAt.getTime() - left.problem.createdAt.getTime() ||
      left.problem.id.localeCompare(right.problem.id),
  );
}

export function selectRecommendations<T extends ScoredRecommendation>(
  recommendations: T[],
): { recommendations: T[]; usedFallback: boolean } {
  const ranked = sortRecommendations(recommendations);
  const qualified = ranked.filter(
    ({ score }) => score >= recommendationConfig.minimumScore,
  );
  const usedFallback = qualified.length === 0;
  const selected = usedFallback
    ? [...recommendations].sort(
        (left, right) =>
          right.problem.createdAt.getTime() - left.problem.createdAt.getTime() ||
          left.problem.id.localeCompare(right.problem.id),
      )
    : qualified;

  return {
    recommendations: selected.slice(0, recommendationConfig.maxItems),
    usedFallback,
  };
}
