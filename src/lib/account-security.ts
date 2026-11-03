export type AccountSecurityState = {
  role: string;
  accountStatus: string;
  authVersion: number;
};

export function isAccountSessionCurrent(
  account: AccountSecurityState | null,
  tokenAuthVersion: number | undefined,
): boolean {
  return Boolean(
    account &&
      account.accountStatus === "ACTIVE" &&
      tokenAuthVersion !== undefined &&
      account.authVersion === tokenAuthVersion,
  );
}

export function getAccountStatusLabel(status: string): string {
  return status === "LOCKED" ? "Bị khóa" : "Hoạt động";
}
