export const MIN_MILESTONE_SUBMISSION_NOTE_LENGTH = 10;
export const MAX_MILESTONE_SUBMISSION_LINKS = 3;

export function parseMilestoneSubmissionLinks(rawValue: string): string[] {
  return rawValue
    .split(/\r?\n/)
    .map((link) => link.trim())
    .filter(Boolean);
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function getStoredMilestoneSubmissionLinks(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((link): link is string => typeof link === "string" && isHttpUrl(link))
      : [];
  } catch {
    return [];
  }
}

export function validateMilestoneSubmission(
  note: string,
  fileCount: number,
  links: string[],
): string | null {
  if (note.trim().length < MIN_MILESTONE_SUBMISSION_NOTE_LENGTH) {
    return `Mô tả kết quả cần có ít nhất ${MIN_MILESTONE_SUBMISSION_NOTE_LENGTH} ký tự.`;
  }
  if (links.length > MAX_MILESTONE_SUBMISSION_LINKS) {
    return `Chỉ được nhập tối đa ${MAX_MILESTONE_SUBMISSION_LINKS} liên kết.`;
  }
  if (links.some((link) => !isHttpUrl(link))) {
    return "Liên kết phải là URL bắt đầu bằng http:// hoặc https://.";
  }
  if (fileCount < 1 && links.length < 1) {
    return "Vui lòng đính kèm ít nhất một tệp hoặc nhập một liên kết sản phẩm.";
  }
  return null;
}
