import assert from "node:assert/strict";
import test from "node:test";

test("handoff completeness rejects late submission and missing deliverables", () => {
  process.env.DATABASE_URL ??= "file:/tmp/unibridge-handoff-completeness.db";
  return import("./proposal-handoff").then(({ validateProposalHandoffCompleteness }) => {
    const result = validateProposalHandoffCompleteness({
    description: "Đã bàn giao bản mô tả nhưng chưa có sản phẩm.",
    files: [],
    deliverables: "Demo website, Tài liệu hướng dẫn",
    deadline: new Date("2026-11-01T00:00:00.000Z"),
    submittedAt: new Date("2026-11-02T00:00:00.000Z"),
    });
    assert.equal(result.passed, false);
    assert.ok(result.missingItems.some((item) => item.includes("đường dẫn demo")));
    assert.ok(result.missingItems.some((item) => item.includes("sau thời hạn")));
    assert.ok(result.missingItems.some((item) => item.includes("sản phẩm đầu ra")));
  });
});

test("handoff completeness accepts a valid file and matching deliverable", async () => {
  process.env.DATABASE_URL ??= "file:/tmp/unibridge-handoff-completeness.db";
  const { validateProposalHandoffCompleteness } = await import("./proposal-handoff");
  const result = validateProposalHandoffCompleteness({
    description: "Đã bàn giao Demo website theo phạm vi đã thống nhất.",
    files: [{ originalName: "demo.pdf", contentType: "application/pdf", sizeBytes: 1000 }],
    deliverables: "Demo website",
    deadline: new Date("2026-11-02T00:00:00.000Z"),
    submittedAt: new Date("2026-11-01T00:00:00.000Z"),
  });
  assert.equal(result.passed, true);
});
