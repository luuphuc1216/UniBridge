import Link from "next/link";
import {
  Activity,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  FolderKanban,
  MessageSquareText,
  Sparkles,
} from "lucide-react";
import { requireBusinessProfile } from "@/lib/business-access";
import { prisma } from "@/lib/prisma";
import { ensureBusinessCreditNotifications } from "@/lib/business-credit-notifications";
import { getUnreadWorkspaceMessageCount } from "@/lib/workspace-messages";
import {
  BUSINESS_PROBLEM_STATUS_GROUPS,
  getEffectiveApplicationCounts,
} from "@/lib/business-dashboard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export default async function BusinessDashboard() {
  const { businessProfileId } = await requireBusinessProfile();
  const sessionProfile = await prisma.businessProfile.findUniqueOrThrow({
    where: { id: businessProfileId },
    select: { userId: true },
  });
  try {
    await prisma.$transaction((transaction) =>
      ensureBusinessCreditNotifications(transaction, {
        businessProfileId,
        userId: sessionProfile.userId,
      }),
    );
  } catch (error) {
    console.error("Không thể tạo thông báo hạn mức doanh nghiệp:", error);
  }
  const credits = await prisma.postCredit.aggregate({
    where: { businessProfileId, remaining: { gt: 0 } },
    _sum: { remaining: true },
  });
  const remaining = credits._sum.remaining ?? 0;
  const [problems, activeProjects, completedProjects, subscription, notifications, unreadMessages, pendingReview, pendingInvitations, pendingInvitationDeadline, pendingProposals, pendingMilestones, pendingAgreements] =
    await Promise.all([
      prisma.problem.findMany({ where: { businessProfileId }, select: { id: true, status: true } }),
      prisma.project.count({ where: { application: { problem: { businessProfileId } }, status: { in: ["AGREEING", "PROTOTYPING", "IN_PROGRESS"] } } }),
      prisma.project.count({ where: { application: { problem: { businessProfileId } }, status: "COMPLETED" } }),
      prisma.subscription.findFirst({ where: { businessProfileId, status: "ACTIVE", endsAt: { gt: new Date() } }, orderBy: { endsAt: "desc" } }),
      prisma.notification.findMany({ where: { userId: sessionProfile.userId }, orderBy: { createdAt: "desc" }, take: 8 }),
      getUnreadWorkspaceMessageCount(sessionProfile.userId, "BUSINESS"),
      prisma.application.count({ where: { problem: { businessProfileId }, needsReview: true, status: { in: ["SUBMITTED", "PENDING_CONFIRMATION", "SELECTED"] } } }),
      prisma.applicationInvitation.count({ where: { invitedByBusinessProfileId: businessProfileId, status: "PENDING_CONFIRMATION" } }),
      prisma.applicationInvitation.findFirst({ where: { invitedByBusinessProfileId: businessProfileId, status: "PENDING_CONFIRMATION" }, orderBy: { expiresAt: "asc" }, select: { expiresAt: true } }),
      prisma.proposal.count({ where: { application: { problem: { businessProfileId } }, status: { in: ["SUBMITTED", "EVALUATING"] } } }),
      prisma.milestone.count({ where: { project: { application: { problem: { businessProfileId } } }, status: "SUBMITTED" } }),
      prisma.project.count({ where: { application: { problem: { businessProfileId } }, status: "AGREEING" } }),
    ]);
  const effectiveApplicationCounts = await getEffectiveApplicationCounts(
    problems.map(({ id }) => id),
  );
  const statusCounts = new Map<string, number>();
  for (const problem of problems) {
    statusCounts.set(problem.status, (statusCounts.get(problem.status) ?? 0) + 1);
  }
  const totalEffectiveApplications = [...effectiveApplicationCounts.values()].reduce(
    (sum, count) => sum + count,
    0,
  );
  const problemStatusLinks = BUSINESS_PROBLEM_STATUS_GROUPS.map(({ key, label, statuses }) => ({
    status: key,
    label,
    count: statuses.reduce((sum, status) => sum + (statusCounts.get(status) ?? 0), 0),
  }));
  const needsRevisionCount = statusCounts.get("NEEDS_REVISION") ?? 0;
  const changesRequestedCount = statusCounts.get("CHANGES_REQUESTED") ?? 0;
  const totalNeedsRevision = needsRevisionCount + changesRequestedCount;
  return (
    <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      <section className="flex flex-col gap-5 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-primary">Khu vực doanh nghiệp</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Tổng quan
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Theo dõi bài toán, dự án và những công việc cần doanh nghiệp xử lý.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
            href="/business/problems/new"
          >
            <BriefcaseBusiness aria-hidden="true" className="mr-2 size-4" />
            Đăng bài toán
          </Link>
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
            href="/business/problems"
          >
            Quản lý bài toán
          </Link>
        </div>
      </section>

      <section aria-label="Tổng quan hoạt động" className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Bài toán", value: problems.length, icon: BriefcaseBusiness },
          { label: "Hồ sơ nhận được", value: totalEffectiveApplications, icon: FileCheck2 },
          { label: "Dự án đang thực hiện", value: activeProjects, icon: FolderKanban },
          { label: "Dự án hoàn tất", value: completedProjects, icon: CheckCircle2 },
        ].map(({ label, value, icon: Icon }) => (
          <Card className="min-w-0 p-5 sm:p-6" key={label}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted-foreground">{label}</p>
                <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">{value}</p>
              </div>
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Icon aria-hidden="true" className="size-5" />
              </span>
            </div>
          </Card>
        ))}
      </section>

      <section className="mt-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Phân loại bài toán</CardTitle>
            <p className="text-sm text-muted-foreground">
              Mở danh sách bài toán theo từng trạng thái.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {problemStatusLinks.map(({ status, label, count }) => (
            <Link
              className="flex min-h-12 min-w-0 items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 text-sm transition-colors hover:border-primary/30 hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
              href={`/business/problems?status=${status}`}
              key={status}
            >
              <span className="min-w-0 break-words text-foreground">{label}</span>
              <Badge className="shrink-0" variant="outline">{count}</Badge>
            </Link>
          ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mt-6">
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-warning/15 text-foreground">
                <ClipboardList aria-hidden="true" className="size-5" />
              </span>
              <div>
                <CardTitle>Cần xử lý</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Các mục cần doanh nghiệp xem xét hoặc phản hồi.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {totalNeedsRevision > 0 && (
                <Link
                  className="flex min-h-16 items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm transition-colors hover:border-primary/30 hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
                  href="/business/problems?status=NEEDS_REVISION"
                >
                  <span className="font-medium text-foreground">Bài toán cần chỉnh sửa</span>
                  <Badge className="shrink-0" variant="warning">{totalNeedsRevision}</Badge>
                </Link>
              )}
              {pendingReview > 0 && (
                <Link
                  className="flex min-h-16 items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm transition-colors hover:border-primary/30 hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
                  href="/business/problems"
                >
                  <span className="font-medium text-foreground">Hồ sơ cần xem xét</span>
                  <Badge className="shrink-0" variant="default">{pendingReview}</Badge>
                </Link>
              )}
              {pendingInvitations > 0 && (
                <Link
                  className="flex min-h-16 items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm transition-colors hover:border-primary/30 hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
                  href="/business/problems"
                >
                  <span className="min-w-0">
                    <span className="block font-medium text-foreground">
                      Lời mời đang chờ nhóm phản hồi
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Hạn gần nhất:{" "}
                      {pendingInvitationDeadline
                        ? new Intl.DateTimeFormat("vi-VN").format(
                            pendingInvitationDeadline.expiresAt,
                          )
                        : "chưa xác định"}
                    </span>
                  </span>
                  <Badge className="shrink-0" variant="warning">{pendingInvitations}</Badge>
                </Link>
              )}
              {pendingProposals > 0 && (
                <Link
                  className="flex min-h-16 items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm transition-colors hover:border-primary/30 hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
                  href="/business/projects"
                >
                  <span className="font-medium text-foreground">Proposal chờ đánh giá</span>
                  <Badge className="shrink-0" variant="default">{pendingProposals}</Badge>
                </Link>
              )}
              {pendingMilestones > 0 && (
                <Link
                  className="flex min-h-16 items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm transition-colors hover:border-primary/30 hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
                  href="/business/projects"
                >
                  <span className="font-medium text-foreground">Milestone chờ nghiệm thu</span>
                  <Badge className="shrink-0" variant="warning">{pendingMilestones}</Badge>
                </Link>
              )}
              {pendingAgreements > 0 && (
                <Link
                  className="flex min-h-16 items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm transition-colors hover:border-primary/30 hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
                  href="/business/problems"
                >
                  <span className="font-medium text-foreground">Thỏa thuận chờ xác nhận</span>
                  <Badge className="shrink-0" variant="warning">{pendingAgreements}</Badge>
                </Link>
              )}
              {unreadMessages > 0 && (
                <Link
                  className="flex min-h-16 items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm transition-colors hover:border-primary/30 hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
                  href="/business/messages"
                >
                  <span className="flex min-w-0 items-center gap-2 font-medium text-foreground">
                    <MessageSquareText aria-hidden="true" className="size-4 shrink-0 text-primary" />
                    Tin nhắn chưa đọc
                  </span>
                  <Badge className="shrink-0" variant="default">{unreadMessages}</Badge>
                </Link>
              )}
              {pendingReview === 0 &&
                pendingInvitations === 0 &&
                pendingProposals === 0 &&
                pendingMilestones === 0 &&
                pendingAgreements === 0 &&
                unreadMessages === 0 &&
                totalNeedsRevision === 0 && (
                  <EmptyState
                    className="sm:col-span-2 xl:col-span-3"
                    description="Các mục cần doanh nghiệp quan tâm sẽ xuất hiện tại đây."
                    icon={<CheckCircle2 aria-hidden="true" className="size-5" />}
                    title="Không có việc cần xử lý."
                  />
                )}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mt-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Activity aria-hidden="true" className="size-5" />
              </span>
              <div>
                <CardTitle>Hoạt động gần đây</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Cập nhật mới nhất từ tài khoản doanh nghiệp.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {notifications.length === 0 ? (
              <EmptyState
                description="Thông báo mới sẽ được hiển thị tại đây."
                icon={<Activity aria-hidden="true" className="size-5" />}
                title="Chưa có hoạt động mới."
              />
            ) : (
              <ul className="divide-y divide-border">
                {notifications.map((notification) => (
                  <li
                    className="flex min-w-0 gap-3 py-4 first:pt-1 last:pb-1"
                    key={notification.id}
                  >
                    <span className="mt-1 grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                      <Activity aria-hidden="true" className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold text-foreground">
                        {notification.title}
                      </p>
                      <p className="mt-1 break-words text-sm leading-6 text-muted-foreground">
                        {notification.message}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="mt-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Sparkles aria-hidden="true" className="size-5" />
              </span>
              <div>
                <CardTitle>Hạn mức và Premium</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Theo dõi lượt đăng hiện có và gói đang sử dụng.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 rounded-2xl bg-muted/60 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div>
                <p className="text-sm text-muted-foreground">Lượt đăng còn lại</p>
                <p className="mt-1 text-3xl font-bold tracking-tight text-foreground">
                  {remaining}
                </p>
              </div>
              <Badge className="w-fit" variant={subscription ? "success" : "outline"}>
                {subscription
                  ? `Premium đến ${new Intl.DateTimeFormat("vi-VN").format(subscription.endsAt)}`
                  : "Chưa có gói Premium đang hoạt động"}
              </Badge>
            </div>
            {remaining === 0 && (
              <p className="mt-4 rounded-xl border border-warning/30 bg-warning/15 px-4 py-3 text-sm leading-6 text-foreground">
                Bạn đã hết lượt đăng. Hãy mua thêm lượt hoặc Premium trước khi gửi bài toán.
              </p>
            )}
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
                href="/business/problems/new"
              >
                Đăng bài toán
              </Link>
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
                href="/business/problems"
              >
                Bài toán của tôi
              </Link>
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
                href="/business/profile"
              >
                Hồ sơ doanh nghiệp
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
