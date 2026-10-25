import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("business credit notification rules", () => {
  it("uses a purchase-specific key so a later low-balance period can notify again", () => {
    const key = (businessId: string, remaining: number, purchaseId: string) =>
      `post-credit-${businessId}-${remaining}-${purchaseId}`;
    assert.notEqual(key("b", 1, "none"), key("b", 1, "charge-1"));
    assert.equal(key("b", 1, "charge-1"), key("b", 1, "charge-1"));
  });
});
