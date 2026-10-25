import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canReadWorkspaceMessage,
  getLegacyMessageApplicationId,
  isApplicationTeamMember,
} from "./workspace-message-scope";

describe("workspace message application scope", () => {
  it("does not let group B read group A messages", () => {
    assert.equal(canReadWorkspaceMessage("application-a", "application-b"), false);
    assert.equal(canReadWorkspaceMessage("application-a", "application-a"), true);
  });

  it("keeps an unknown legacy message unassigned", () => {
    assert.equal(getLegacyMessageApplicationId([]), null);
    assert.equal(getLegacyMessageApplicationId(["application-a", "application-b"]), null);
    assert.equal(getLegacyMessageApplicationId(["application-a"]), "application-a");
  });

  it("denies a user outside the application team", () => {
    const team = { ownerId: "owner-a", memberUserIds: ["member-a"] };
    assert.equal(isApplicationTeamMember(team, "member-b"), false);
    assert.equal(isApplicationTeamMember(team, "member-a"), true);
  });
});
