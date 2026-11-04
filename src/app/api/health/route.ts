import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHealthResponse } from "@/lib/health";

export async function GET() {
  await connection();
  return createHealthResponse(() => prisma.$queryRaw`SELECT 1`);
}
