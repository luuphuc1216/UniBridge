import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { reportTargetTypes, submitReport } from "@/lib/reports";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Vui lòng đăng nhập để gửi báo cáo." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu báo cáo không hợp lệ." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Dữ liệu báo cáo không hợp lệ." }, { status: 400 });
  }
  const report = body as {
    targetType?: unknown;
    targetId?: unknown;
    reason?: unknown;
  };
  if (
    typeof report.targetType !== "string" ||
    !reportTargetTypes.includes(report.targetType as (typeof reportTargetTypes)[number]) ||
    typeof report.targetId !== "string" ||
    report.targetId.length === 0 ||
    report.targetId.length > 200 ||
    typeof report.reason !== "string" ||
    report.reason.trim().length < 5 ||
    report.reason.trim().length > 2000
  ) {
    return NextResponse.json({ error: "Dữ liệu báo cáo không hợp lệ." }, { status: 400 });
  }

  const result = await submitReport(prisma, {
    reporterId: session.user.id,
    reporterRole: session.user.role,
    targetType: report.targetType as (typeof reportTargetTypes)[number],
    targetId: report.targetId,
    reason: report.reason,
  });
  if (result === "target_unavailable") {
    return NextResponse.json({ error: "Không thể gửi báo cáo cho nội dung này." }, { status: 404 });
  }
  if (result === "duplicate") {
    return NextResponse.json(
      { error: "Bạn đã có báo cáo đang mở cho nội dung này." },
      { status: 409 },
    );
  }
  return NextResponse.json({ message: "Báo cáo đã được gửi để quản trị viên xem xét." }, { status: 201 });
}
