import assert from "node:assert/strict";
import { describe, it } from "node:test";
import nextConfig from "../../next.config";

describe("security response headers", () => {
  it("sets the required headers across all routes", async () => {
    const rules = await nextConfig.headers?.();
    assert.ok(rules);
    assert.equal(rules.length, 1);
    assert.equal(rules[0]?.source, "/:path*");
    assert.deepEqual(
      Object.fromEntries(
        rules[0]?.headers.map(({ key, value }) => [key, value]) ?? [],
      ),
      {
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
        "X-Frame-Options": "DENY",
      },
    );
  });
});
