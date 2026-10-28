export function getPrototypeProblemStatusLabel(problem: {
  status: string;
  prototypeLegacy: boolean;
  evaluationResult: string | null;
  implementationDecision: string | null;
}): string {
  if (!problem.prototypeLegacy) {
    if (
      problem.evaluationResult === "ACCEPTED" &&
      problem.implementationDecision === "PENDING"
    ) {
      return "Prototype đã được chấp nhận · chờ quyết định triển khai";
    }
    if (
      problem.evaluationResult === "ACCEPTED" &&
      problem.implementationDecision === "ENDED"
    ) {
      return "Đã kết thúc sau khi chấp nhận Prototype";
    }
    if (
      problem.evaluationResult === "ACCEPTED" &&
      problem.implementationDecision === "IMPLEMENT"
    ) {
      return "Đã quyết định triển khai · chờ thỏa thuận";
    }
    if (problem.evaluationResult === "STOPPED") {
      return "Không tiếp tục Prototype";
    }
  }
  return (
    {
      DRAFT: "Bản nháp",
      PENDING_REVIEW: "Chờ duyệt",
      NEEDS_REVISION: "Cần chỉnh sửa",
      CHANGES_REQUESTED: "Cần chỉnh sửa",
      REJECTED: "Bị từ chối",
      APPROVED: "Đã duyệt",
      PUBLISHED: "Đang nhận hồ sơ",
      TEAM_SELECTED: "Đã chọn nhóm",
      PROTOTYPING: "Đang xây dựng Prototype / Solution Proposal",
      EVALUATING: "Doanh nghiệp đang đánh giá Proposal",
      CLOSED: "Đã kết thúc – không triển khai",
      READY_FOR_IMPLEMENTATION: "Sẵn sàng soạn thỏa thuận Paid Implementation",
      COMPLETED: "Đã hoàn thành",
      SUBMITTED: "Đã nộp",
      ACCEPTED: "Được chấp nhận",
    }[problem.status] ?? problem.status
  );
}
