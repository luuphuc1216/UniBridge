import assert from "node:assert/strict";
import test from "node:test";
import { canCreatePendingInvitation } from "@/lib/problem-workflow";

test("a second pending invitation is rejected", () => {
  assert.equal(canCreatePendingInvitation(0), true);
  assert.equal(canCreatePendingInvitation(1), false);
});
