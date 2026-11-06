import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { generateProblemDraftSuggestion } from "@/lib/ai/problem-draft";
import { AI_FEATURES, AI_LIMITS } from "@/lib/ai/config";
import { AiNotConfiguredError, AiProviderError } from "@/lib/ai/provider";
import { completeAiUsage, getAiUsageRemaining, reserveAiUsage } from "@/lib/ai/usage";
import { requireActivePremium } from "@/lib/ai/access";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  let usageId: string | null = null;
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "BUSINESS") {
      return NextResponse.json({ error: "Bạn cần đăng nhập bằng tài khoản doanh nghiệp." }, { status: 403 });
    }
    const profile = await prisma.businessProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!profile) return NextResponse.json({ error: "Không tìm thấy hồ sơ doanh nghiệp." }, { status: 403 });
    await requireActivePremium(profile.id);
    const body = (await request.json()) as { brief?: unknown };
    const brief = typeof body.brief === "string" ? body.brief.trim() : "";
    if (!brief || brief.length > AI_LIMITS.maxInputChars) {
      return NextResponse.json({ error: `Ý ngắn cần từ 1 đến ${AI_LIMITS.maxInputChars} ký tự.` }, { status: 400 });
    }
    const reservation = await prisma.$transaction((transaction) =>
      reserveAiUsage(transaction, { businessProfileId: profile.id, feature: AI_FEATURES.problemDraft }),
    );
    usageId = reservation.usageId;
    const suggestion = await generateProblemDraftSuggestion(brief);
    await completeAiUsage(prisma, usageId, "SUCCEEDED");
    return NextResponse.json({
      suggestion,
      remaining: await getAiUsageRemaining(prisma, profile.id),
    });
  } catch (error) {
    if (usageId) await completeAiUsage(prisma, usageId, "FAILED").catch(() => undefined);
    const message =
      error instanceof AiNotConfiguredError || error instanceof AiProviderError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Không thể sử dụng AI lúc này.";
    const status = /Premium|lượt AI|đăng nhập|hồ sơ/.test(message) ? 403 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
