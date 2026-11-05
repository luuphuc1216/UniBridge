import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createHealthResponse } from "./health";

describe("health response", () => {
  it("reports a live database as healthy without caching", async () => {
    const response = await createHealthResponse(async () => [{ "1": 1 }]);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.deepEqual(await response.json(), { status: "ok" });
  });

  it("reports database failures as unavailable without leaking details", async () => {
    const response = await createHealthResponse(async () => {
      throw new Error("secret database path and diagnostic");
    });

    assert.equal(response.status, 503);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.deepEqual(await response.json(), { status: "unavailable" });
    assert.equal(response.headers.get("Set-Cookie"), null);
  });
});
