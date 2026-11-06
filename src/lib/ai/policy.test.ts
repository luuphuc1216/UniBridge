import assert from "node:assert/strict";
import test from "node:test";
import { canExplainApplication, isActivePremium } from "./policy";

test("AI policy blocks non-Premium and expired subscriptions", () => {
  const now = new Date("2026-11-06T00:00:00.000Z");
  assert.equal(isActivePremium(null, now), false);
  assert.equal(
    isActivePremium({ package: "PREMIUM", status: "ACTIVE", endsAt: new Date("2026-11-05") }, now),
    false,
  );
  assert.equal(
    isActivePremium({ package: "FREE", status: "ACTIVE", endsAt: new Date("2026-12-01") }, now),
    false,
  );
});

test("AI application explanation requires own open approved problem and application", () => {
  assert.equal(
    canExplainApplication({
      ownsProblem: false,
      problemStatus: "APPROVED",
      applicationStatus: "SUBMITTED",
    }),
    false,
  );
  assert.equal(
    canExplainApplication({
      ownsProblem: true,
      problemStatus: "DRAFT",
      applicationStatus: "SUBMITTED",
    }),
    false,
  );
  assert.equal(
    canExplainApplication({
      ownsProblem: true,
      problemStatus: "APPROVED",
      applicationStatus: "SUBMITTED",
    }),
    true,
  );
});
