import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  APPLICATION_STATUS_DISPLAY,
  canRespondToInvitation,
  getApplicationStatusDisplay,
} from "@/lib/application-status";

describe("Application status display", () => {
  it("has a Vietnamese label and display tone for every application status", () => {
    const statuses = [
      "SUBMITTED",
      "PENDING_CONFIRMATION",
      "SELECTED",
      "DECLINED",
      "EXPIRED",
      "NOT_SELECTED",
      "REJECTED",
      "WITHDRAWN",
    ];
    for (const status of statuses) {
      const display = getApplicationStatusDisplay(status);
      assert.ok(display.label.length > 0);
      assert.ok(display.tone.length > 0);
      assert.equal(APPLICATION_STATUS_DISPLAY[status], display);
    }
  });

  it("does not turn an unknown status into a rejection label", () => {
    assert.notEqual(getApplicationStatusDisplay("FUTURE_STATUS").label, "Đã từ chối");
  });

  it("only enables invitation response for the team owner", () => {
    assert.equal(canRespondToInvitation("PENDING_CONFIRMATION", true), true);
    assert.equal(canRespondToInvitation("PENDING_CONFIRMATION", false), false);
    assert.equal(canRespondToInvitation("SELECTED", true), false);
  });
});
