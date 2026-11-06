import Link from "next/link";
import { requireBusinessProfile } from "@/lib/business-access";
import { prisma } from "@/lib/prisma";
import { ensureBusinessCreditNotifications } from "@/lib/business-credit-notifications";
import { getUnreadWorkspaceMessageCount } from "@/lib/workspace-messages";
import {
  BUSINESS_PROBLEM_STATUS_GROUPS,
  getEffectiveApplicationCounts,
} from "@/lib/business-dashboard";

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
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="text-sm font-semibold text-primary">Khu vực doanh nghiệp</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Tổng quan</h1>
      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Bài toán", problems.length],
          ["Hồ sơ nhận được", totalEffectiveApplications],
          ["Dự án đang thực hiện", activeProjects],
          ["Dự án hoàn tất", completedProjects],
        ].map(([label, value]) => (
          <div className="rounded-2xl border border-border bg-card p-5" key={label as string}>
            <p className="text-sm text-muted-foreground">{label as string}</p>
            <p className="mt-2 text-3xl font-bold">{value as number}</p>
          </div>
        ))}
      </section>
      <section className="mt-6 rounded-2xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Phân loại bài toán</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {problemStatusLinks.map(({ status, label, count }) => (
            <Link
              className="flex items-center justify-between rounded-xl border border-border px-4 py-3 text-sm hover:bg-muted"
              href={`/business/problems?status=${status}`}
              key={status}
            >
              <span>{label}</span>
              <strong>{count}</strong>
            </Link>
          ))}
        </div>
      </section>
      <section className="mt-6 rounded-2xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Cần xử lý</h2>
        <div className="mt-4 grid gap-2 text-sm">
          {totalNeedsRevision > 0 && <Link className="text-primary hover:underline" href="/business/problems?status=NEEDS_REVISION">Bài toán cần chỉnh sửa ({totalNeedsRevision})</Link>}
          {pendingReview > 0 && <Link className="text-primary hover:underline" href="/business/problems">Hồ sơ cần xem xét ({pendingReview})</Link>}
          {pendingInvitations > 0 && <Link className="text-primary hover:underline" href="/business/problems">Lời mời đang chờ nhóm phản hồi ({pendingInvitations}) — hạn gần nhất: {pendingInvitationDeadline ? new Intl.DateTimeFormat("vi-VN").format(pendingInvitationDeadline.expiresAt) : "chưa xác định"}</Link>}
          {pendingProposals > 0 && <Link className="text-primary hover:underline" href="/business/projects">Proposal chờ đánh giá ({pendingProposals})</Link>}
          {pendingMilestones > 0 && <Link className="text-primary hover:underline" href="/business/projects">Milestone chờ nghiệm thu ({pendingMilestones})</Link>}
          {pendingAgreements > 0 && <Link className="text-primary hover:underline" href="/business/problems">Thỏa thuận chờ xác nhận ({pendingAgreements})</Link>}
          {unreadMessages > 0 && <Link className="text-primary hover:underline" href="/business/messages">Tin nhắn chưa đọc ({unreadMessages})</Link>}
          {pendingReview === 0 && pendingInvitations === 0 && pendingProposals === 0 && pendingMilestones === 0 && pendingAgreements === 0 && unreadMessages === 0 && totalNeedsRevision === 0 && <p className="text-muted-foreground">Không có việc cần xử lý.</p>}
        </div>
      </section>
      <section className="mt-6 rounded-2xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Hoạt động gần đây</h2>
        <ul className="mt-4 grid gap-3 text-sm">
          {notifications.length === 0 ? <li className="text-muted-foreground">Chưa có hoạt động mới.</li> : notifications.map((notification) => (
            <li className="border-b border-border pb-2 last:border-0" key={notification.id}>{notification.title} — {notification.message}</li>
          ))}
        </ul>
      </section>
      <section className="mt-6 rounded-2xl border border-dashed border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Hạn mức</h2>
        <p className="mt-2 text-sm text-muted-foreground">Lượt đăng còn lại: {remaining}. {subscription ? `Premium đến ${new Intl.DateTimeFormat("vi-VN").format(subscription.endsAt)}.` : "Chưa có gói Premium đang hoạt động."}</p>
        {remaining === 0 && (
          <p className="mt-4 rounded-xl bg-amber-100 px-4 py-3 text-sm text-amber-900">
            Bạn đã hết lượt đăng. Hãy mua thêm lượt hoặc Premium trước khi gửi bài toán.
          </p>
        )}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
            href="/business/problems/new"
          >
            Đăng bài toán
          </Link>
          <Link
            className="rounded-xl border border-border px-5 py-3 text-sm font-semibold hover:bg-muted"
            href="/business/problems"
          >
            Bài toán của tôi
          </Link>
          <Link className="rounded-xl border border-border px-5 py-3 text-center text-sm font-semibold hover:bg-muted" href="/business/profile">Hồ sơ doanh nghiệp</Link>
        </div>
      </section>
    </main>
  );
}
