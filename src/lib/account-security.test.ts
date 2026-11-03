import assert from "node:assert/strict";
import test from "node:test";
import { isAccountSessionCurrent } from "./account-security";

test("keeps a session valid only for the current active account version", () => {
  assert.equal(
    isAccountSessionCurrent(
      { role: "STUDENT", accountStatus: "ACTIVE", authVersion: 4 },
      4,
    ),
    true,
  );
  assert.equal(
    isAccountSessionCurrent(
      { role: "STUDENT", accountStatus: "LOCKED", authVersion: 4 },
      4,
    ),
    false,
  );
  assert.equal(
    isAccountSessionCurrent(
      { role: "STUDENT", accountStatus: "ACTIVE", authVersion: 5 },
      4,
    ),
    false,
  );
  assert.equal(isAccountSessionCurrent(null, 4), false);
});
