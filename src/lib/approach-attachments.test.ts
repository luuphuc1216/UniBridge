import assert from "node:assert/strict";
import test from "node:test";
import {
  canDownloadApproachAttachment,
  canReplaceApproachAttachments,
  createApproachAttachmentRecords,
  assertApproachAttachmentSetWithinLimits,
  getApproachAttachmentFiles,
  MAX_APPROACH_ATTACHMENT_COUNT,
} from "./approach-attachments";
import { validateAttachment } from "./business-attachments/validation";
import { MAX_ATTACHMENT_SIZE_BYTES } from "./business-attachments/config";

test("approach uploads reject executable extensions and mismatched file contents", async () => {
  const executable = new File(["MZ"], "program.exe", {
    type: "application/octet-stream",
  });
  const fakePdf = new File(["not a PDF"], "example.pdf", {
    type: "application/pdf",
  });
  const fakeDocx = new File(
    [new Uint8Array([0x50, 0x4b, 0x03, 0x04]).buffer],
    "example.docx",
    { type: "application/zip" },
  );

  await assert.rejects(validateAttachment(executable), /Chỉ chấp nhận PDF/);
  await assert.rejects(validateAttachment(fakePdf), /không khớp với định dạng/);
  await assert.rejects(validateAttachment(fakeDocx), /không khớp với định dạng/);
});

test("approach uploads accept validated CSV documents", async () => {
  const file = new File(["chi_so,gia_tri\nDon_hang,120\n"], "sample.csv", {
    type: "text/csv",
  });
  const validated = await validateAttachment(file);
  assert.equal(validated.contentType, "text/csv");
  assert.equal(validated.originalName, "sample.csv");
});

test("approach uploads enforce the per-file size limit on the server", async () => {
  const oversized = new File(
    [new Uint8Array(MAX_ATTACHMENT_SIZE_BYTES + 1).buffer],
    "large.pdf",
    { type: "application/pdf" },
  );
  await assert.rejects(validateAttachment(oversized), /không được vượt quá 20 MB/);
});

test("approach form rejects more than the allowed number of files", () => {
  const formData = new FormData();
  for (let index = 0; index < MAX_APPROACH_ATTACHMENT_COUNT + 1; index += 1) {
    formData.append(
      "approachAttachments",
      new File(["%PDF-1.7"], `file-${index}.pdf`, { type: "application/pdf" }),
    );
  }

  assert.throws(() => getApproachAttachmentFiles(formData), /tối đa 3 tệp/);
});

test("only the submitting team, problem owner, and admin can download", () => {
  assert.equal(
    canDownloadApproachAttachment({
      role: "STUDENT",
      isTeamMember: false,
      isProblemOwner: false,
      applicationStatus: "SUBMITTED",
    }),
    false,
  );
  assert.equal(
    canDownloadApproachAttachment({
      role: "STUDENT",
      isTeamMember: true,
      isProblemOwner: false,
      applicationStatus: "SUBMITTED",
    }),
    true,
  );
  assert.equal(
    canDownloadApproachAttachment({
      role: "BUSINESS",
      isTeamMember: false,
      isProblemOwner: true,
      applicationStatus: "SUBMITTED",
    }),
    true,
  );
  assert.equal(
    canDownloadApproachAttachment({
      role: "BUSINESS",
      isTeamMember: false,
      isProblemOwner: true,
      applicationStatus: "DRAFT",
    }),
    false,
  );
  assert.equal(
    canDownloadApproachAttachment({
      role: "ADMIN",
      isTeamMember: false,
      isProblemOwner: false,
      applicationStatus: "DRAFT",
    }),
    true,
  );
});

test("approach attachments can be replaced only before submission", () => {
  assert.equal(canReplaceApproachAttachments(null), true);
  assert.equal(canReplaceApproachAttachments("DRAFT"), true);
  assert.equal(canReplaceApproachAttachments("WITHDRAWN"), true);
  assert.equal(canReplaceApproachAttachments("SUBMITTED"), false);
  assert.equal(canReplaceApproachAttachments("SELECTED"), false);
});

test("draft files and new files still obey the combined set limits", () => {
  assert.throws(
    () =>
      assertApproachAttachmentSetWithinLimits(
        [{ sizeBytes: 1 }, { sizeBytes: 1 }, { sizeBytes: 1 }],
        [{ sizeBytes: 1 }],
      ),
    /tối đa 3 tệp/,
  );
  assert.throws(
    () =>
      assertApproachAttachmentSetWithinLimits(
        [{ sizeBytes: 60 * 1024 * 1024 }],
        [{ sizeBytes: 1 }],
      ),
    /Tổng dung lượng tài liệu vượt quá 60 MB/,
  );
});

test("persisting attachment rows does not create or count additional applications", async () => {
  const applications = [{ id: "application-1" }];
  const applicationCountBefore = applications.length;
  const attachmentRows: { applicationId: string; storageKey: string }[] = [];

  await createApproachAttachmentRecords(
    {
      async createMany({ data }) {
        attachmentRows.push(
          ...data.map(({ applicationId, storageKey }) => ({
            applicationId,
            storageKey,
          })),
        );
        return { count: data.length };
      },
    },
    [
      {
        applicationId: "application-1",
        submissionVersion: 1,
        originalName: "one.pdf",
        contentType: "application/pdf",
        sizeBytes: 10,
        storageKey: "file-key-1",
      },
      {
        applicationId: "application-1",
        submissionVersion: 1,
        originalName: "two.pdf",
        contentType: "application/pdf",
        sizeBytes: 20,
        storageKey: "file-key-2",
      },
    ],
  );

  assert.equal(attachmentRows.length, 2);
  assert.equal(applications.length, applicationCountBefore);
});
