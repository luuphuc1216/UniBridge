import assert from "node:assert/strict";
import test from "node:test";
import {
  getAdminAiAssistFailure,
  getAdminAiAssistStatus,
  getStoredAdminAiAssistStatus,
} from "./admin-assist";

test("Admin AI Assist result labels distinguish AI, rule-only, unavailable, and stale runs", () => {
  assert.equal(getAdminAiAssistStatus("AI", 3, 3), "AI");
  assert.equal(getAdminAiAssistStatus("RULE_REJECT", 3, 3), "RULES_ONLY");
  assert.equal(getAdminAiAssistStatus("AI_UNAVAILABLE", 3, 3), "UNAVAILABLE");
  assert.equal(getAdminAiAssistStatus("AI", 3, 4), "STALE");
  assert.equal(getAdminAiAssistStatus("AI", 3, null), "STALE");
});

test("stored Admin AI Assist results are stale when their problem version no longer matches", () => {
  assert.equal(getStoredAdminAiAssistStatus("COMPLETED", 2, 2), "AI");
  assert.equal(getStoredAdminAiAssistStatus("UNAVAILABLE", 2, 2), "UNAVAILABLE");
  assert.equal(getStoredAdminAiAssistStatus("RULES_ONLY", 2, 2), "RULES_ONLY");
  assert.equal(getStoredAdminAiAssistStatus("COMPLETED", 2, 3), "STALE");
  assert.equal(getStoredAdminAiAssistStatus("STALE", 3, 3), "STALE");
});

test("quota failures are explicit while unknown errors never expose raw details", () => {
  assert.deepEqual(
    getAdminAiAssistFailure(new Error("Bạn đã hết lượt AI trong ngày.")),
    { status: "UNAVAILABLE", message: "Bạn đã hết lượt AI trong ngày." },
  );
  const failure = getAdminAiAssistFailure(
    new Error("Provider echoed a secret API key and stack details."),
  );
  assert.equal(failure.status, "ERROR");
  assert.equal(
    failure.message,
    "Không thể hoàn tất AI Assist lúc này. Vui lòng tải lại trang và thử lại.",
  );
  assert.equal(failure.message.includes("secret API key"), false);
});
