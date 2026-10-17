// Tập trung toàn bộ trọng số và giới hạn Recommendation tại một nơi để dễ tinh chỉnh.
export const recommendationConfig = {
  maxItems: 6,
  maxReasons: 3,
  minimumScore: 18,
  historyLimit: 100,
  maxSkillMatches: 3,
  reputation: {
    maxRating: 5,
    fullWeightRatingCount: 5,
    maxPoints: 8,
  },
  points: {
    majorMatch: 18,
    skillMatch: 9,
    interestMatch: 15,
    viewedFieldMatch: 7,
    viewedSkillMatch: 4,
    savedFieldMatch: 12,
    savedSkillMatch: 7,
    searchedFieldMatch: 12,
    searchedSkillMatch: 8,
    searchedQueryMatch: 6,
    appliedFieldMatch: 8,
    appliedSkillMatch: 5,
  },
} as const;
