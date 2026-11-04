export async function createHealthResponse(
  checkDatabase: () => Promise<unknown>,
  timeoutMs = 2_000,
): Promise<Response> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    await Promise.race([
      checkDatabase(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("Database health check timed out")), timeoutMs);
      }),
    ]);
    return Response.json(
      { status: "ok" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
