import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canDownloadProblemAttachment } from "@/lib/business-attachments/access";

const approvedProblem = {
  role: "STUDENT",
  userId: "student",
  businessUserId: "business",
  status: "APPROVED",
  approvedAt: new Date("2026-01-01T00:00:00.000Z"),
  hiddenByAdmin: false,
};

describe("business Problem attachment access", () => {
  it("allows students to download only approved, visible Problem attachments", () => {
    assert.equal(canDownloadProblemAttachment(approvedProblem), true);
    assert.equal(
      canDownloadProblemAttachment({ ...approvedProblem, hiddenByAdmin: true }),
      false,
    );
    assert.equal(
      canDownloadProblemAttachment({ ...approvedProblem, approvedAt: null }),
      false,
    );
    assert.equal(
      canDownloadProblemAttachment({ ...approvedProblem, status: "CLOSED" }),
      false,
    );
  });

  it("preserves Admin and owning Business access while denying unrelated roles", () => {
    assert.equal(
      canDownloadProblemAttachment({
        ...approvedProblem,
        role: "ADMIN",
        approvedAt: null,
        hiddenByAdmin: true,
      }),
      true,
    );
    assert.equal(
      canDownloadProblemAttachment({
        ...approvedProblem,
        role: "BUSINESS",
        userId: "business",
        approvedAt: null,
        hiddenByAdmin: true,
      }),
      true,
    );
    assert.equal(
      canDownloadProblemAttachment({
        ...approvedProblem,
        role: "BUSINESS",
        userId: "other-business",
      }),
      false,
    );
  });
});
