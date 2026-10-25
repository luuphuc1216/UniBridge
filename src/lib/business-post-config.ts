export const POST_CREDIT_SOURCES = {
  FREE: "FREE",
  PREMIUM: "PREMIUM",
  PURCHASED: "PURCHASED",
} as const;

export const PLATFORM_CHARGE_TYPES = {
  POST_PURCHASE: "POST_PURCHASE",
  PREMIUM: "PREMIUM",
} as const;

export const BUSINESS_POST_CONFIG = {
  freePostCredits: 2,
  purchasedPostCreditPriceVnd: 99_000,
  premiumPriceVnd: 699_000,
  premiumPostCredits: 10,
  premiumDurationMonths: 3,
  maxPurchasedCreditsPerOrder: 20,
} as const;

export type PostCreditSource =
  (typeof POST_CREDIT_SOURCES)[keyof typeof POST_CREDIT_SOURCES];

export type PlatformChargeType =
  (typeof PLATFORM_CHARGE_TYPES)[keyof typeof PLATFORM_CHARGE_TYPES];

export function isPostCreditSource(value: string): value is PostCreditSource {
  return Object.values(POST_CREDIT_SOURCES).includes(value as PostCreditSource);
}

export function isPlatformChargeType(value: string): value is PlatformChargeType {
  return Object.values(PLATFORM_CHARGE_TYPES).includes(value as PlatformChargeType);
}
