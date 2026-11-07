export const MAX_ATTACHMENT_COUNT = 3;
export const MAX_ATTACHMENT_SIZE_BYTES = 20 * 1024 * 1024;
export const MAX_PROPOSAL_FILE_COUNT = MAX_ATTACHMENT_COUNT;
export const MAX_PROPOSAL_FILE_SIZE_BYTES = MAX_ATTACHMENT_SIZE_BYTES;
export const MAX_PROPOSAL_FILE_TOTAL_BYTES =
  MAX_PROPOSAL_FILE_COUNT * MAX_PROPOSAL_FILE_SIZE_BYTES;
export const MAX_ATTACHMENT_TOTAL_BYTES =
  MAX_ATTACHMENT_COUNT * MAX_ATTACHMENT_SIZE_BYTES;
export const UPLOAD_BODY_SIZE_LIMIT: `${number}mb` = `${Math.ceil(
  (MAX_ATTACHMENT_TOTAL_BYTES + 4 * 1024 * 1024) / (1024 * 1024),
)}mb`;

export const ALLOWED_ATTACHMENT_TYPES = {
  ".pdf": {
    contentType: "application/pdf",
    label: "PDF",
  },
  ".docx": {
    contentType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    label: "DOCX",
  },
  ".xlsx": {
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    label: "XLSX",
  },
  ".pptx": {
    contentType:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    label: "PPTX",
  },
  ".csv": {
    contentType: "text/csv",
    label: "CSV",
  },
  ".png": {
    contentType: "image/png",
    label: "PNG",
  },
  ".jpg": {
    contentType: "image/jpeg",
    label: "JPG",
  },
  ".jpeg": {
    contentType: "image/jpeg",
    label: "JPEG",
  },
} as const;

export const ALLOWED_ATTACHMENT_EXTENSIONS = Object.keys(
  ALLOWED_ATTACHMENT_TYPES,
);
