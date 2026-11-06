import {
  MAX_ATTACHMENT_COUNT,
  MAX_ATTACHMENT_TOTAL_BYTES,
} from "@/lib/business-attachments/config";

export const MAX_APPROACH_ATTACHMENT_COUNT = MAX_ATTACHMENT_COUNT;
export const MAX_APPROACH_ATTACHMENT_TOTAL_BYTES = MAX_ATTACHMENT_TOTAL_BYTES;

export type ApproachAttachmentInput = {
  applicationId: string;
  submissionVersion: number;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  storageKey: string;
};

export type ApproachAttachmentRepository = {
  createMany(args: { data: ApproachAttachmentInput[] }): Promise<unknown>;
};

export function getApproachAttachmentFiles(formData: FormData): File[] {
  const values = formData.getAll("approachAttachments");
  const files: File[] = [];
  for (const value of values) {
    if (typeof value === "string") {
      throw new Error("Danh sách tệp đính kèm không hợp lệ.");
    }
    if (value.name || value.size > 0) files.push(value);
  }
  if (files.length > MAX_APPROACH_ATTACHMENT_COUNT) {
    throw new Error(`Chỉ được tải lên tối đa ${MAX_APPROACH_ATTACHMENT_COUNT} tệp.`);
  }
  if (
    files.reduce((total, file) => total + file.size, 0) >
    MAX_APPROACH_ATTACHMENT_TOTAL_BYTES
  ) {
    throw new Error("Tổng dung lượng tài liệu vượt quá 60 MB.");
  }
  return files;
}

export function canReplaceApproachAttachments(status: string | null): boolean {
  return status === null || status === "DRAFT" || status === "WITHDRAWN";
}

export function assertApproachAttachmentSetWithinLimits(
  existingFiles: { sizeBytes: number }[],
  newFiles: { sizeBytes: number }[],
): void {
  const count = existingFiles.length + newFiles.length;
  if (count > MAX_APPROACH_ATTACHMENT_COUNT) {
    throw new Error(`Chỉ được tải lên tối đa ${MAX_APPROACH_ATTACHMENT_COUNT} tệp.`);
  }
  const totalBytes = [...existingFiles, ...newFiles].reduce(
    (total, file) => total + file.sizeBytes,
    0,
  );
  if (totalBytes > MAX_APPROACH_ATTACHMENT_TOTAL_BYTES) {
    throw new Error("Tổng dung lượng tài liệu vượt quá 60 MB.");
  }
}

export function canDownloadApproachAttachment({
  role,
  isTeamMember,
  isProblemOwner,
  applicationStatus,
}: {
  role: string;
  isTeamMember: boolean;
  isProblemOwner: boolean;
  applicationStatus: string;
}): boolean {
  if (role === "ADMIN") return true;
  if (role === "STUDENT") return isTeamMember;
  return role === "BUSINESS" && isProblemOwner && applicationStatus !== "DRAFT";
}

export async function createApproachAttachmentRecords(
  repository: ApproachAttachmentRepository,
  records: ApproachAttachmentInput[],
): Promise<void> {
  if (records.length > 0) {
    await repository.createMany({ data: records });
  }
}
