export const reputationConfig = {
  reviewVisibilityDelayDays: 14,
  reviewsPerPage: 10,
  ratingScale: [
    { value: 1, label: "Chưa đạt", explanation: "Kết quả thấp hơn đáng kể so với kỳ vọng." },
    { value: 2, label: "Cần cải thiện", explanation: "Đã có nỗ lực nhưng còn nhiều điểm cần khắc phục." },
    { value: 3, label: "Đạt yêu cầu", explanation: "Đáp ứng những yêu cầu cơ bản đã thống nhất." },
    { value: 4, label: "Tốt", explanation: "Đáp ứng tốt yêu cầu và có ít điểm cần điều chỉnh." },
    { value: 5, label: "Xuất sắc", explanation: "Vượt kỳ vọng, thể hiện chất lượng và trách nhiệm nổi bật." },
  ],
  criteria: {
    BUSINESS_TO_TEAM: [
      { key: "resultQuality", label: "Chất lượng kết quả", explanation: "Mức độ hoàn thiện và chất lượng sản phẩm bàn giao." },
      { key: "timeliness", label: "Tiến độ", explanation: "Khả năng thực hiện các Milestone đúng thời hạn." },
      { key: "requirementFit", label: "Mức độ đáp ứng yêu cầu", explanation: "Mức độ bám sát phạm vi và yêu cầu đã thống nhất." },
      { key: "collaboration", label: "Khả năng phối hợp", explanation: "Trao đổi, tiếp nhận phản hồi và phối hợp với doanh nghiệp." },
      { key: "professionalism", label: "Mức độ chuyên nghiệp", explanation: "Tác phong, trách nhiệm và sự chủ động trong quá trình làm việc." },
    ],
    TEAM_TO_BUSINESS: [
      { key: "requirementClarity", label: "Sự rõ ràng của yêu cầu", explanation: "Mức độ cụ thể, nhất quán của phạm vi và tiêu chí nghiệm thu." },
      { key: "responseTime", label: "Phản hồi kịp thời", explanation: "Khả năng phản hồi câu hỏi và góp ý đúng thời điểm." },
      { key: "fairAcceptance", label: "Nghiệm thu công bằng", explanation: "Mức độ khách quan, đúng tiêu chí và phạm vi đã thống nhất." },
      { key: "cooperation", label: "Tinh thần hợp tác", explanation: "Mức độ phối hợp, cung cấp thông tin và hỗ trợ nhóm." },
    ],
  },
  // Điểm prior trung tính giúp một vài đánh giá không tạo lợi thế quá lớn.
  ratingSmoothing: {
    priorAverage: 3,
    priorReviewCount: 5,
  },
  // Trọng số Reputation tổng hợp (tổng bằng 100%).
  weights: {
    rating: 55,
    completion: 15,
    onTime: 15,
    positiveReviews: 10,
    fundedProjectHistory: 5,
  },
  positiveRatingMinimum: 4,
  fundedProjectHistorySaturation: 5,
  maximumRating: 5,
} as const;

export type ReviewDirection = keyof typeof reputationConfig.criteria;
export type ReviewCriterionKey =
  (typeof reputationConfig.criteria)[ReviewDirection][number]["key"];
