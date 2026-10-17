import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateMilestoneSubmission } from "@/lib/milestone-submission-validation";

describe("validateMilestoneSubmission", () => {
  const validNote = "Kết quả đã hoàn thành theo tiêu chí.";

  it("accepts a submission with at least one file", () => {
    assert.equal(validateMilestoneSubmission(validNote, 1, []), null);
  });

  it("accepts a submission with an HTTP(S) link", () => {
    assert.equal(
      validateMilestoneSubmission(validNote, 0, ["https://example.com/product"]),
      null,
    );
  });

  it("accepts a submission with both files and links", () => {
    assert.equal(
      validateMilestoneSubmission(validNote, 2, ["http://example.com"]),
      null,
    );
  });

  it("rejects a submission without files or links", () => {
    assert.match(
      validateMilestoneSubmission(validNote, 0, []) ?? "",
      /ít nhất một tệp hoặc nhập một liên kết/,
    );
  });

  it("rejects a description shorter than ten characters", () => {
    assert.match(
      validateMilestoneSubmission("ngắn", 1, []) ?? "",
      /ít nhất 10 ký tự/,
    );
  });

  it("rejects links that do not use HTTP or HTTPS", () => {
    assert.match(
      validateMilestoneSubmission(validNote, 0, ["javascript:alert(1)"]) ?? "",
      /http:\/\/ hoặc https:\/\//,
    );
  });
});
