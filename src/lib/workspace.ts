export const proposalTypes = [
  "PROTOTYPE_INTERFACE",
  "EXPERIMENTAL_MODEL",
  "PRODUCT_SAMPLE",
  "DESIGN",
  "MARKETING_PLAN",
  "MARKET_RESEARCH",
  "DATA_ANALYSIS",
  "DETAILED_SOLUTION_PROPOSAL",
] as const;

export const proposalTypeOptions = [
  ["PROTOTYPE_INTERFACE", "Prototype giao diện"],
  ["EXPERIMENTAL_MODEL", "Mô hình thử nghiệm"],
  ["PRODUCT_SAMPLE", "Bản mẫu sản phẩm"],
  ["DESIGN", "Bản thiết kế"],
  ["MARKETING_PLAN", "Phương án Marketing"],
  ["MARKET_RESEARCH", "Phương án nghiên cứu thị trường"],
  ["DATA_ANALYSIS", "Phương án phân tích dữ liệu"],
  ["DETAILED_SOLUTION_PROPOSAL", "Solution Proposal chi tiết"],
] as const;

export const proposalEvaluationFields = [
  [
    "problemResponse",
    "Mức độ đáp ứng vấn đề ban đầu",
    "Giải pháp xử lý được vấn đề và nhu cầu đã nêu đến mức nào",
  ],
  [
    "feasibility",
    "Tính khả thi của giải pháp",
    "Giải pháp có thể thực hiện với công nghệ và nguồn lực hiện có đến mức nào",
  ],
  [
    "goalAlignment",
    "Mức độ phù hợp với mục tiêu doanh nghiệp",
    "Giải pháp hỗ trợ các mục tiêu ưu tiên của doanh nghiệp đến mức nào",
  ],
  [
    "practicalImplementation",
    "Khả năng triển khai thực tế",
    "Giải pháp có thể áp dụng trong hoạt động thực tế đến mức nào",
  ],
  [
    "estimatedCost",
    "Chi phí dự kiến",
    "Mức độ hợp lý của chi phí so với ngân sách của bạn",
  ],
  [
    "implementationTime",
    "Thời gian triển khai",
    "Mức độ phù hợp của thời gian so với mong muốn của bạn",
  ],
  [
    "valueDelivered",
    "Giá trị mà giải pháp mang lại",
    "Lợi ích dự kiến có tương xứng với chi phí và công sức bỏ ra không",
  ],
] as const;

export const evaluationScoreLabels: Record<number, string> = {
  1: "Chưa đạt",
  2: "Còn hạn chế",
  3: "Chấp nhận được",
  4: "Tốt",
  5: "Rất tốt",
};
