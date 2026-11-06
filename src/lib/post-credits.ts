import type { Prisma } from "@/generated/prisma/client";
import {
  BUSINESS_POST_CONFIG,
  PLATFORM_CHARGE_TYPES,
  POST_CREDIT_SOURCES,
  type PostCreditSource,
} from "./business-post-config";

export type CreditClock = { now(): Date };

export const systemClock: CreditClock = { now: () => new Date() };

export type CreditConsumptionResult =
  | { status: "consumed"; source: PostCreditSource; creditId: string }
  | { status: "already_processed" }
  | { status: "no_credits" };

export type SubmitProblemResult =
  | { status: "submitted"; source?: PostCreditSource }
  | { status: "no_credits" }
  | { status: "already_processed" };

export class CreditAlreadyProcessedError extends Error {
  constructor() {
    super("Bài toán đã được gửi duyệt hoặc đã được xử lý ở tab khác.");
    this.name = "CreditAlreadyProcessedError";
  }
}

export class CreditPayloadConflictError extends Error {
  constructor() {
    super("Mã giao dịch đã được sử dụng cho một nội dung mua khác.");
    this.name = "CreditPayloadConflictError";
  }
}

type Transaction = Prisma.TransactionClient;

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function sourceOrder(source: string): number {
  return source === POST_CREDIT_SOURCES.FREE
    ? 0
    : source === POST_CREDIT_SOURCES.PREMIUM
      ? 1
      : source === POST_CREDIT_SOURCES.PURCHASED
        ? 2
        : 3;
}

export async function ensureFreePostCredits(
  transaction: Transaction,
  businessProfileId: string,
): Promise<void> {
  const existing = await transaction.postCredit.findFirst({
    where: { businessProfileId, source: POST_CREDIT_SOURCES.FREE },
    select: { id: true },
  });
  if (!existing) {
    await transaction.postCredit.create({
      data: {
        businessProfileId,
        source: POST_CREDIT_SOURCES.FREE,
        remaining: BUSINESS_POST_CONFIG.freePostCredits,
      },
    });
  }
}

export async function consumePostCredit(
  transaction: Transaction,
  {
    businessProfileId,
    problemId,
    clock = systemClock,
  }: {
    businessProfileId: string;
    problemId: string;
    clock?: CreditClock;
  },
): Promise<CreditConsumptionResult> {
  const now = clock.now();
  const problem = await transaction.problem.findFirst({
    where: { id: problemId, businessProfileId },
    select: { status: true, consumedCreditId: true },
  });
  if (!problem || problem.consumedCreditId || problem.status !== "DRAFT") {
    return { status: "already_processed" };
  }

  const credits = await transaction.postCredit.findMany({
    where: {
      businessProfileId,
      remaining: { gt: 0 },
      OR: [
        { source: { in: [POST_CREDIT_SOURCES.FREE, POST_CREDIT_SOURCES.PURCHASED] } },
        { source: POST_CREDIT_SOURCES.PREMIUM, expiresAt: { gt: now } },
      ],
    },
    orderBy: [{ createdAt: "asc" }],
  });
  credits.sort((left, right) => {
    const sourceDifference = sourceOrder(left.source) - sourceOrder(right.source);
    if (sourceDifference !== 0) return sourceDifference;
    return (left.expiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER) -
      (right.expiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER);
  });

  for (const credit of credits) {
    const creditUpdate = await transaction.postCredit.updateMany({
      where: {
        id: credit.id,
        remaining: { gt: 0 },
        ...(credit.source === POST_CREDIT_SOURCES.PREMIUM
          ? { expiresAt: { gt: now } }
          : {}),
      },
      data: { remaining: { decrement: 1 } },
    });
    if (creditUpdate.count !== 1) continue;

    const problemUpdate = await transaction.problem.updateMany({
      where: {
        id: problemId,
        businessProfileId,
        status: "DRAFT",
        consumedCreditId: null,
      },
      data: {
        status: "PENDING_REVIEW",
        submittedAt: now,
        consumedCreditId: credit.id,
        creditRefundedAt: null,
      },
    });
    if (problemUpdate.count !== 1) throw new CreditAlreadyProcessedError();
    return {
      status: "consumed",
      source: credit.source as PostCreditSource,
      creditId: credit.id,
    };
  }
  return { status: "no_credits" };
}

export async function submitProblemForReview(
  transaction: Transaction,
  {
    businessProfileId,
    problemId,
    clock = systemClock,
  }: {
    businessProfileId: string;
    problemId: string;
    clock?: CreditClock;
  },
): Promise<SubmitProblemResult> {
  const problem = await transaction.problem.findFirst({
    where: { id: problemId, businessProfileId },
    select: { status: true, consumedCreditId: true },
  });
  if (!problem) throw new Error("Không tìm thấy bài toán thuộc tài khoản này.");
  if (problem.status === "PENDING_REVIEW") return { status: "already_processed" };

  if (problem.consumedCreditId) {
    const updated = await transaction.problem.updateMany({
      where: {
        id: problemId,
        businessProfileId,
        status: { in: ["DRAFT", "NEEDS_REVISION", "CHANGES_REQUESTED", "REJECTED"] },
        consumedCreditId: { not: null },
      },
      data: {
        status: "PENDING_REVIEW",
        submittedAt: clock.now(),
        reviewNote: null,
        reviewedById: null,
        approvedAt: null,
      },
    });
    if (updated.count !== 1) return { status: "already_processed" };
    return { status: "submitted" };
  }

  const consumed = await consumePostCredit(transaction, {
    businessProfileId,
    problemId,
    clock,
  });
  if (consumed.status === "consumed") {
    return { status: "submitted", source: consumed.source };
  }
  return consumed.status === "no_credits"
    ? { status: "no_credits" }
    : { status: "already_processed" };
}

export async function refundProblemCredit(
  transaction: Transaction,
  {
    problemId,
    clock = systemClock,
  }: { problemId: string; clock?: CreditClock },
): Promise<boolean> {
  const problem = await transaction.problem.findUnique({
    where: { id: problemId },
    select: {
      businessProfileId: true,
      consumedCreditId: true,
      creditRefundedAt: true,
      firstApprovedAt: true,
    },
  });
  if (!problem?.consumedCreditId || problem.creditRefundedAt || problem.firstApprovedAt) {
    return false;
  }

  const marked = await transaction.problem.updateMany({
    where: {
      id: problemId,
      consumedCreditId: problem.consumedCreditId,
      creditRefundedAt: null,
    },
    data: { creditRefundedAt: clock.now() },
  });
  if (marked.count !== 1) return false;

  const credit = await transaction.postCredit.findUnique({
    where: { id: problem.consumedCreditId },
    select: { source: true, expiresAt: true },
  });
  if (!credit) throw new Error("Không tìm thấy lượt đã trừ để hoàn.");

  const expiredPremium =
    credit.source === POST_CREDIT_SOURCES.PREMIUM &&
    credit.expiresAt !== null &&
    credit.expiresAt <= clock.now();
  if (expiredPremium) {
    const free = await transaction.postCredit.findFirst({
      where: { businessProfileId: problem.businessProfileId, source: POST_CREDIT_SOURCES.FREE },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (free) {
      await transaction.postCredit.update({
        where: { id: free.id },
        data: { remaining: { increment: 1 } },
      });
    } else {
      await transaction.postCredit.create({
        data: {
          businessProfileId: problem.businessProfileId,
          source: POST_CREDIT_SOURCES.FREE,
          remaining: 1,
        },
      });
    }
  } else {
    await transaction.postCredit.update({
      where: { id: problem.consumedCreditId },
      data: { remaining: { increment: 1 } },
    });
  }
  return true;
}

export async function isPremium(
  transaction: Transaction,
  businessProfileId: string,
  clock = systemClock,
): Promise<boolean> {
  return Boolean(
    await transaction.subscription.findFirst({
      where: {
        businessProfileId,
        package: "PREMIUM",
        status: "ACTIVE",
        endsAt: { gt: clock.now() },
      },
      select: { id: true },
    }),
  );
}

export async function purchasePostCredits(
  transaction: Transaction,
  {
    businessProfileId,
    buyerId,
    quantity,
    idempotencyKey,
  }: {
    businessProfileId: string;
    buyerId: string;
    quantity: number;
    idempotencyKey: string;
  },
) {
  if (
    !Number.isSafeInteger(quantity) ||
    quantity < 1 ||
    quantity > BUSINESS_POST_CONFIG.maxPurchasedCreditsPerOrder
  ) {
    throw new Error("Số lượt mua không hợp lệ hoặc vượt quá giới hạn mỗi lần mua.");
  }
  const amount = quantity * BUSINESS_POST_CONFIG.purchasedPostCreditPriceVnd;
  const existing = await transaction.platformCharge.findUnique({
    where: { idempotencyKey },
  });
  if (existing) {
    if (
      existing.type !== PLATFORM_CHARGE_TYPES.POST_PURCHASE ||
      existing.units !== quantity ||
      existing.amount !== amount
    ) {
      throw new CreditPayloadConflictError();
    }
    return existing;
  }
  const charge = await transaction.platformCharge.create({
    data: {
      businessProfileId,
      buyerId,
      type: PLATFORM_CHARGE_TYPES.POST_PURCHASE,
      amount,
      units: quantity,
      quantity,
      idempotencyKey,
    },
  });
  await transaction.postCredit.create({
    data: { businessProfileId, source: POST_CREDIT_SOURCES.PURCHASED, remaining: quantity },
  });
  return charge;
}

export async function purchasePremium(
  transaction: Transaction,
  {
    businessProfileId,
    buyerId,
    idempotencyKey,
    clock = systemClock,
  }: {
    businessProfileId: string;
    buyerId: string;
    idempotencyKey: string;
    clock?: CreditClock;
  },
) {
  const existing = await transaction.platformCharge.findUnique({
    where: { idempotencyKey },
  });
  if (existing) {
    if (
      existing.type !== PLATFORM_CHARGE_TYPES.PREMIUM ||
      existing.units !== 1 ||
      existing.amount !== BUSINESS_POST_CONFIG.premiumPriceVnd
    ) {
      throw new CreditPayloadConflictError();
    }
    return existing;
  }
  const now = clock.now();
  const current = await transaction.subscription.findUnique({
    where: { businessProfileId_package: { businessProfileId, package: "PREMIUM" } },
  });
  const startsAt = current && current.endsAt > now ? current.endsAt : now;
  const endsAt = addMonths(startsAt, BUSINESS_POST_CONFIG.premiumDurationMonths);
  const charge = await transaction.platformCharge.create({
    data: {
      businessProfileId,
      buyerId,
      type: PLATFORM_CHARGE_TYPES.PREMIUM,
      amount: BUSINESS_POST_CONFIG.premiumPriceVnd,
      units: 1,
      quantity: BUSINESS_POST_CONFIG.premiumPostCredits,
      periodStartsAt: startsAt,
      periodEndsAt: endsAt,
      idempotencyKey,
    },
  });
  await transaction.subscription.upsert({
    where: { businessProfileId_package: { businessProfileId, package: "PREMIUM" } },
    create: { businessProfileId, package: "PREMIUM", startsAt: now, endsAt },
    update: { startsAt, endsAt, status: "ACTIVE" },
  });
  await transaction.postCredit.create({
    data: {
      businessProfileId,
      source: POST_CREDIT_SOURCES.PREMIUM,
      remaining: BUSINESS_POST_CONFIG.premiumPostCredits,
      expiresAt: endsAt,
    },
  });
  return charge;
}
