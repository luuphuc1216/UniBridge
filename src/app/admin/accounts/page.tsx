import { requireAdmin } from "@/lib/admin-access";
import { getAccountStatusLabel } from "@/lib/account-security";
import { prisma } from "@/lib/prisma";
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
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <p className="text-sm font-semibold text-primary">Khu vực quản trị</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Quản lý tài khoản</h1>
      {knownResult && (
        <p aria-live="polite" className="mt-4 rounded-lg bg-muted p-3 text-sm">
          {knownResult}
        </p>
      )}
      <div className="mt-8 grid gap-4">
        {users.map((user, index) => (
          <article className="rounded-2xl border border-border bg-card p-5" key={user.id}>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="font-semibold">{user.name}</h2>
                <p className="text-sm text-muted-foreground">{user.email}</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>Vai trò: {user.role}</span>
                  <span>Trạng thái: {getAccountStatusLabel(user.accountStatus)}</span>
                  <span>Đăng ký: {formatDate(user.createdAt)}</span>
                  <span>Đăng nhập gần nhất: {formatDate(user.lastLoginAt)}</span>
                </div>
                {user.lockReason && (
                  <p className="mt-2 text-sm text-destructive">Lý do khóa: {user.lockReason}</p>
                )}
                {activeProjectCounts[index] > 0 && (
                  <p className="mt-2 text-sm font-medium text-amber-800">
                    Cảnh báo: tài khoản này có {activeProjectCounts[index]} dự án đang thực hiện.
                    Khóa tài khoản không thay đổi trạng thái dự án hoặc giao dịch.
                  </p>
                )}
              </div>
              <form action={setAccountStatusAction} className="grid gap-2 sm:min-w-80">
                <input name="userId" type="hidden" value={user.id} />
                <input
                  name="status"
                  type="hidden"
                  value={user.accountStatus === "ACTIVE" ? "LOCKED" : "ACTIVE"}
                />
                <label className="text-xs font-medium" htmlFor={`reason-${user.id}`}>
                  Lý do bắt buộc
                </label>
                <textarea
                  className="min-h-20 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  id={`reason-${user.id}`}
                  maxLength={1000}
                  minLength={3}
                  name="reason"
                  required
                />
                <button
                  className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
                  type="submit"
                >
                  {user.accountStatus === "ACTIVE" ? "Khóa tài khoản" : "Mở khóa"}
                </button>
              </form>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
