export const LEGACY_EVALUATION_DISABLED_MESSAGE =
  "Luồng đánh giá mới chưa được bật cho bài toán này. Vui lòng chờ bản cập nhật tiếp theo.";

export function assertLegacyEvaluationEnabled(prototypeLegacy: boolean): void {
  if (!prototypeLegacy) {
    throw new Error(LEGACY_EVALUATION_DISABLED_MESSAGE);
  }
}
