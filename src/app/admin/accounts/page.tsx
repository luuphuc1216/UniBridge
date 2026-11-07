import { requireAdmin } from "@/lib/admin-access";
import { getAccountStatusLabel } from "@/lib/account-security";
import { prisma } from "@/lib/prisma";
import { AlertTriangle, BriefcaseBusiness, CalendarDays, Clock3, LockKeyhole, ShieldCheck, UnlockKeyhole, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Textarea } from "@/components/ui/textarea";
import { setAccountStatusAction } from "./actions";

export const instant = false;

const resultMessages: Record<string, string> = {
  updated: "Đã cập nhật trạng thái tài khoản.",
  unchanged: "Tài khoản đã ở trạng thái này; không có thay đổi mới.",
  self: "Bạn không thể tự khóa tài khoản của mình.",
  "last-admin": "Không thể khóa quản trị viên cuối cùng đang hoạt động.",
  conflict: "Tài khoản vừa được cập nhật. Hãy tải lại trang.",
  missing: "Không tìm thấy tài khoản.",
  invalid: "Thông tin thao tác không hợp lệ.",
};

const roleLabels: Record<string, string> = {
  ADMIN: "Quản trị viên",
  BUSINESS: "Doanh nghiệp",
  STUDENT: "Sinh viên",
};

const roleBadgeVariants: Record<string, "default" | "secondary" | "outline"> = {
  ADMIN: "default",
  BUSINESS: "secondary",
  STUDENT: "outline",
};

function formatDate(value: Date | null): string {
  return value
    ? new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(value)
    : "Chưa đăng nhập";
}

export default async function AdminAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  await requireAdmin();
  const [{ result }, users] = await Promise.all([
    searchParams,
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        accountStatus: true,
        lastLoginAt: true,
        lockedAt: true,
        lockReason: true,
        createdAt: true,
      },
    }),
  ]);
  const activeProjectCounts = await Promise.all(
    users.map((user) =>
      prisma.project.count({
        where: {
          status: "IN_PROGRESS",
          OR: [
            { application: { problem: { businessProfile: { userId: user.id } } } },
            { team: { ownerId: user.id } },
            { team: { memberships: { some: { studentProfile: { userId: user.id } } } } },
          ],
        },
      }),
    ),
  );
  const knownResult = result && resultMessages[result] ? resultMessages[result] : null;

  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      <header className="max-w-3xl">
        <p className="text-sm font-semibold text-primary">Khu vực quản trị</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Quản lý tài khoản
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">
          Theo dõi vai trò, trạng thái và thông tin truy cập của các tài khoản trên UniBridge.
        </p>
      </header>
      {knownResult && (
        <div
          aria-live="polite"
          className={`mt-5 flex items-start gap-3 rounded-2xl border p-4 text-sm leading-6 ${
            result === "updated"
              ? "border-success/30 bg-success/10 text-foreground"
              : result === "unchanged"
                ? "border-border bg-card text-foreground"
                : "border-destructive/25 bg-destructive/5 text-destructive"
          }`}
          role="status"
        >
          {result === "updated" ? (
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success" />
          ) : (
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          )}
          <p>{knownResult}</p>
        </div>
      )}
      <section aria-label="Danh sách tài khoản" className="mt-7">
        {users.length === 0 ? (
          <EmptyState
            className="bg-card"
            description="Các tài khoản sẽ xuất hiện tại đây khi được tạo."
            icon={<UserRound aria-hidden="true" className="size-5" />}
            title="Chưa có tài khoản"
          />
        ) : (
          <ul className="grid gap-4">
            {users.map((user, index) => {
              const isActive = user.accountStatus === "ACTIVE";
              const activeProjectCount = activeProjectCounts[index];
              return (
                <li key={user.id}>
                  <Card className="min-w-0 overflow-hidden p-0">
                    <div className="grid min-w-0 lg:grid-cols-[minmax(0,1fr)_minmax(19rem,24rem)]">
                      <div className="min-w-0 p-5 sm:p-6">
                        <div className="flex min-w-0 items-start gap-3">
                          <span
                            aria-hidden="true"
                            className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground"
                          >
                            <UserRound className="size-5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                              <h2 className="min-w-0 break-words text-base font-semibold tracking-tight sm:text-lg">
                                {user.name}
                              </h2>
                              <Badge variant={roleBadgeVariants[user.role] ?? "outline"}>
                                {roleLabels[user.role] ?? user.role}
                              </Badge>
                            </div>
                            <p className="mt-1 break-all text-sm text-muted-foreground">
                              {user.email}
                            </p>
                          </div>
                        </div>

                        <div className="mt-5 flex flex-wrap items-center gap-2">
                          <Badge
                            className="gap-1.5"
                            variant={isActive ? "success" : "destructive"}
                          >
                            {isActive ? (
                              <ShieldCheck aria-hidden="true" className="size-3.5" />
                            ) : (
                              <LockKeyhole aria-hidden="true" className="size-3.5" />
                            )}
                            {getAccountStatusLabel(user.accountStatus)}
                          </Badge>
                          <Badge className="gap-1.5" variant="outline">
                            <BriefcaseBusiness aria-hidden="true" className="size-3.5" />
                            {activeProjectCount.toLocaleString("vi-VN")} dự án đang thực hiện
                          </Badge>
                        </div>

                        <dl className="mt-5 grid gap-3 border-t border-border pt-4 text-sm sm:grid-cols-2">
                          <div className="min-w-0">
                            <dt className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                              <CalendarDays aria-hidden="true" className="size-4 shrink-0" />
                              Ngày đăng ký
                            </dt>
                            <dd className="mt-1 break-words font-medium">
                              {formatDate(user.createdAt)}
                            </dd>
                          </div>
                          <div className="min-w-0">
                            <dt className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                              <Clock3 aria-hidden="true" className="size-4 shrink-0" />
                              Đăng nhập gần nhất
                            </dt>
                            <dd className="mt-1 break-words font-medium">
                              {formatDate(user.lastLoginAt)}
                            </dd>
                          </div>
                        </dl>

                        {user.lockReason && (
                          <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 p-3">
                            <p className="flex items-center gap-2 text-xs font-semibold text-destructive">
                              <LockKeyhole aria-hidden="true" className="size-4" />
                              Lý do khóa
                            </p>
                            <p className="mt-1 break-words text-sm leading-6 text-foreground">
                              {user.lockReason}
                            </p>
                          </div>
                        )}

                        {activeProjectCount > 0 && (
                          <div
                            className="mt-4 flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm leading-6 text-foreground"
                            role="note"
                          >
                            <AlertTriangle
                              aria-hidden="true"
                              className="mt-0.5 size-4 shrink-0 text-amber-700"
                            />
                            <p>
                              Tài khoản này có {activeProjectCount} dự án đang thực hiện. Khóa tài
                              khoản không thay đổi trạng thái dự án hoặc giao dịch.
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="border-t border-border bg-muted/30 p-5 sm:p-6 lg:border-l lg:border-t-0">
                        <div className="flex items-start gap-3">
                          <span
                            aria-hidden="true"
                            className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl ${
                              isActive
                                ? "bg-destructive/10 text-destructive"
                                : "bg-success/10 text-success"
                            }`}
                          >
                            {isActive ? (
                              <LockKeyhole className="size-4" />
                            ) : (
                              <UnlockKeyhole className="size-4" />
                            )}
                          </span>
                          <div className="min-w-0">
                            <h3 className="font-semibold">
                              {isActive ? "Khóa tài khoản" : "Mở khóa tài khoản"}
                            </h3>
                            <p className="mt-1 text-sm leading-5 text-muted-foreground">
                              {isActive
                                ? "Nhập lý do để ghi nhận thao tác quản trị."
                                : "Nhập lý do mở khóa tài khoản."}
                            </p>
                          </div>
                        </div>
                        <form action={setAccountStatusAction} className="mt-4 grid gap-3">
                          <input name="userId" type="hidden" value={user.id} />
                          <input
                            name="status"
                            type="hidden"
                            value={isActive ? "LOCKED" : "ACTIVE"}
                          />
                          <div className="grid gap-1.5">
                            <label
                              className="text-sm font-medium"
                              htmlFor={`reason-${user.id}`}
                            >
                              Lý do <span className="text-destructive">(bắt buộc)</span>
                            </label>
                            <Textarea
                              className="min-h-24 bg-background text-base"
                              id={`reason-${user.id}`}
                              maxLength={1000}
                              minLength={3}
                              name="reason"
                              required
                            />
                            <p className="text-xs leading-5 text-muted-foreground">
                              Từ 3 đến 1.000 ký tự.
                            </p>
                          </div>
                          <Button
                            className="w-full sm:w-fit"
                            variant={isActive ? "destructive" : "default"}
                            type="submit"
                          >
                            {isActive ? (
                              <LockKeyhole aria-hidden="true" className="size-4" />
                            ) : (
                              <UnlockKeyhole aria-hidden="true" className="size-4" />
                            )}
                            {isActive ? "Khóa tài khoản" : "Mở khóa tài khoản"}
                          </Button>
                        </form>
                      </div>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
