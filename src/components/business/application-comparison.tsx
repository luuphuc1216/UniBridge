"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  sendInvitationAction,
  updateApplicationReviewAction,
  type ProblemActionState,
} from "@/app/business/problems/actions";
import type { TeamReputation } from "@/lib/reputation";
import {
  formatInvitationExpiry,
  getApplicationStatusDisplay,
} from "@/lib/application-status";

type ApplicationCardData = {
  id: string;
  approach: string;
  problemUnderstanding: string;
  solutionDirection: string;
  methodology: string;
  keySteps: string;
  tools: string;
  resources: string;
  estimatedDuration: string;
  proposedBudget: number | null;
  status: string;
  needsReview: boolean;
  businessReviewNote: string | null;
  invitation: {
    expiresAt: Date;
    status: string;
    responseReason: string | null;
  } | null;
  approachLinks: unknown;
  team: {
    id: string;
    name: string;
    university: string;
    description: string;
    experience: string;
    relevantProducts: string;
    achievements: string;
    interests: string;
    reputation: TeamReputation | undefined;
    skills: string[];
    members: { name: string; major: string }[];
    projects: { title: string }[];
  };
};

type ApplicationComparisonProps = {
  problemId: string;
  applications: ApplicationCardData[];
  problemSkills: string[];
  problemStatus: string;
  hasPendingInvitation: boolean;
};

function formatCurrency(amount: number | null): string {
  return amount === null
    ? "Chưa đề xuất"
    : new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0,
      }).format(amount);
}

function SelectTeamForm({
  problemId,
  applicationId,
  disabled = false,
}: {
  problemId: string;
  applicationId: string;
  disabled?: boolean;
}) {
  const [state, formAction, isPending] = useActionState<
    ProblemActionState,
    FormData
  >(sendInvitationAction, { error: null });

  return (
    <form action={formAction} className="mt-5 border-t border-border pt-4">
      <input name="problemId" type="hidden" value={problemId} />
      <input name="applicationId" type="hidden" value={applicationId} />
      {state.error && (
        <p className="mb-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <button
        className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
        disabled={isPending || disabled}
        type="submit"
      >
        {isPending ? "Đang gửi..." : "Gửi lời mời hợp tác"}
      </button>
    </form>
  );
}

function ReviewForm({ problemId, application }: { problemId: string; application: ApplicationCardData }) {
  const [state, formAction, isPending] = useActionState<
    ProblemActionState,
    FormData
  >(updateApplicationReviewAction, { error: null });
  return (
    <form action={formAction} className="mt-4 border-t border-border pt-4">
      <input name="problemId" type="hidden" value={problemId} />
      <input name="applicationId" type="hidden" value={application.id} />
      <label className="flex items-center gap-2 text-sm">
        <input defaultChecked={application.needsReview} name="needsReview" type="checkbox" />
        Đánh dấu cần xem xét
      </label>
      <textarea
        className="mt-3 min-h-20 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
        defaultValue={application.businessReviewNote ?? ""}
        maxLength={2000}
        name="businessReviewNote"
        placeholder="Ghi chú nội bộ về hồ sơ"
      />
      {state.error && <p className="mt-2 text-sm text-destructive">{state.error}</p>}
      <button className="mt-3 rounded-lg border border-border px-3 py-2 text-sm font-semibold" disabled={isPending} type="submit">
        Lưu ghi chú
      </button>
    </form>
  );
}

export function ApplicationComparison({
  problemId,
  applications,
  problemSkills,
  problemStatus,
  hasPendingInvitation,
}: ApplicationComparisonProps) {
  const canSelect = ["APPROVED", "PUBLISHED"].includes(problemStatus);

  if (applications.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
        <h2 className="font-semibold">Chưa có nhóm ứng tuyển</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Hồ sơ ứng tuyển sẽ xuất hiện tại đây khi có nhóm quan tâm bài toán.
        </p>
      </section>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {applications.map((application) => {
        const matchedSkills = application.team.skills.filter((skill) =>
          problemSkills.includes(skill),
        );
        const approachDetails = [
          ["Cách nhóm hiểu vấn đề", application.problemUnderstanding],
          ["Hướng giải quyết", application.solutionDirection],
          ["Phương pháp thực hiện", application.methodology],
          ["Các bước chính", application.keySteps],
          ["Công cụ hoặc công nghệ", application.tools],
          ["Nguồn lực cần thiết", application.resources],
        ];
        const hasStructuredApproach = approachDetails.some(([, value]) => value);
        const statusDisplay = getApplicationStatusDisplay(application.status);
        const hasPendingApplicationInvitation =
          application.status === "PENDING_CONFIRMATION" &&
          application.invitation?.status === "PENDING_CONFIRMATION";
        const canInvite =
          canSelect &&
          application.status === "SUBMITTED" &&
          !hasPendingInvitation;
        const canOpenChat = ["PENDING_CONFIRMATION", "SELECTED"].includes(
          application.status,
        );
        return (
          <article
            className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"
            key={application.id}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">
                  <Link className="hover:underline" href={`/teams/${application.team.id}`}>
                    {application.team.name}
                  </Link>
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {application.team.university}
                </p>
                <span
                  className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                    statusDisplay.tone === "success"
                      ? "bg-emerald-100 text-emerald-800"
                      : statusDisplay.tone === "danger"
                        ? "bg-rose-100 text-rose-800"
                        : statusDisplay.tone === "pending"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-muted text-muted-foreground"
                  }`}
                >
                  {statusDisplay.label}
                </span>
                {hasPendingApplicationInvitation && application.invitation && (
                  <p className="mt-1 text-xs text-amber-700">
                    {formatInvitationExpiry(application.invitation.expiresAt)}
                  </p>
                )}
                {["DECLINED", "EXPIRED", "NOT_SELECTED"].includes(application.status) &&
                  application.invitation?.responseReason && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Lý do: {application.invitation.responseReason}
                    </p>
                  )}
              </div>
              {application.team.reputation && (
                <div className="rounded-xl bg-primary/10 px-3 py-2 text-right text-sm font-semibold text-primary">
                  <p>
                    Reputation:{" "}
                    {application.team.reputation.score === null
                      ? "Chưa có dữ liệu"
                      : `${application.team.reputation.score} / 100`}
                  </p>
                  <p className="mt-1 text-xs">
                    {application.team.reputation.ratingAverage === null
                      ? "Chưa có đánh giá"
                      : `${application.team.reputation.ratingAverage.toFixed(1)} / 5`}
                    {" · "}
                    {application.team.reputation.ratingCount} lượt ·{" "}
                    {application.team.reputation.completedProjectCount} dự án hoàn tất
                  </p>
                  <p className="mt-1 text-xs">
                    Hoàn thành: {application.team.reputation.completionRate === null
                      ? "chưa có dữ liệu"
                      : `${application.team.reputation.completionRate}%`}
                    {" · "}Đúng hạn: {application.team.reputation.onTimeRate === null
                      ? "chưa có dữ liệu"
                      : `${application.team.reputation.onTimeRate}%`}
                  </p>
                </div>
              )}
            </div>
            <p className="mt-4 text-sm leading-6">{application.team.description}</p>

            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-muted/50 p-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Kỹ năng phù hợp
                </dt>
                <dd className="mt-2 flex flex-wrap gap-1.5">
                  {matchedSkills.length
                    ? matchedSkills.map((skill) => (
                        <span
                          className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800"
                          key={skill}
                        >
                          {skill}
                        </span>
                      ))
                    : "Chưa trùng kỹ năng yêu cầu"}
                </dd>
                <p className="mt-2 text-xs text-muted-foreground">
                  Kỹ năng khác: {application.team.skills.join(", ") || "Chưa cập nhật"}
                </p>
              </div>
              <div className="rounded-xl bg-muted/50 p-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Chuyên môn thành viên
                </dt>
                <dd className="mt-2 text-sm">
                  {application.team.members.length > 0
                    ? application.team.members.map(({ name, major }) => `${name} — ${major}`).join(", ")
                    : "Chưa cập nhật"}
                </dd>
              </div>
              <div className="rounded-xl bg-muted/50 p-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Kinh nghiệm
                </dt>
                <dd className="mt-2 text-sm">
                  {application.team.experience || "Chưa cập nhật"}
                </dd>
              </div>
              <div className="rounded-xl bg-muted/50 p-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Sản phẩm liên quan
                </dt>
                <dd className="mt-2 whitespace-pre-wrap break-words text-sm">
                  {application.team.relevantProducts || "Chưa cập nhật"}
                </dd>
              </div>
              <div className="rounded-xl bg-muted/50 p-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Thành tích và chứng chỉ
                </dt>
                <dd className="mt-2 whitespace-pre-wrap text-sm">
                  {application.team.achievements || "Chưa cập nhật"}
                </dd>
              </div>
              <div className="rounded-xl bg-muted/50 p-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Lĩnh vực quan tâm
                </dt>
                <dd className="mt-2 whitespace-pre-wrap text-sm">
                  {application.team.interests || "Chưa cập nhật"}
                </dd>
              </div>
              <div className="rounded-xl bg-muted/50 p-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Dự án đã hoàn thành trên nền tảng
                </dt>
                <dd className="mt-2 text-sm">
                  {application.team.projects.map(({ title }) => title).join(", ") ||
                    "Chưa có"}
                </dd>
              </div>
              <div className="rounded-xl bg-muted/50 p-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Thời gian dự kiến
                </dt>
                <dd className="mt-2 text-sm">{application.estimatedDuration}</dd>
              </div>
              <div className="rounded-xl bg-muted/50 p-3 sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Chi phí đề xuất
                </dt>
                <dd className="mt-2 text-sm font-semibold">
                  {formatCurrency(application.proposedBudget)}
                </dd>
              </div>
            </dl>
            <section className="mt-5 rounded-xl border border-border p-4">
              <h3 className="text-sm font-semibold">Approach</h3>
              {hasStructuredApproach ? (
                <dl className="mt-3 grid gap-4">
                  {approachDetails.map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
                      <dd className="mt-1 whitespace-pre-wrap text-sm leading-6">
                        {value || "Chưa cập nhật"}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                  {application.approach || "Chưa cập nhật Approach"}
                </p>
              )}
            </section>
            {Array.isArray(application.approachLinks) && application.approachLinks.length > 0 && (
              <section className="mt-5 rounded-xl border border-border p-4">
                <h3 className="text-sm font-semibold">Liên kết tham khảo</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {application.approachLinks.map((link) =>
                    typeof link === "string" ? (
                      <li key={link}><a className="text-primary hover:underline" href={link} rel="noreferrer" target="_blank">{link}</a></li>
                    ) : null,
                  )}
                </ul>
              </section>
            )}
            {canInvite ? (
              <SelectTeamForm
                applicationId={application.id}
                problemId={problemId}
              />
            ) : hasPendingApplicationInvitation ? (
              <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Đang chờ nhóm xác nhận hợp tác trước hạn trên.
              </p>
            ) : canSelect && application.status === "SUBMITTED" && hasPendingInvitation ? (
              <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                Bài toán đang có một lời mời chờ xác nhận. Bạn chỉ có thể mời nhóm khác sau khi lời mời này được từ chối hoặc hết hạn.
              </p>
            ) : (
              <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                Bài toán đã chọn nhóm hoặc không còn nhận lựa chọn.
              </p>
            )}
            <ReviewForm problemId={problemId} application={application} />
            {canOpenChat && (
              <Link
                className="mt-3 inline-flex rounded-lg border border-primary px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/5"
                href={`/business/problems/${problemId}/workspace?applicationId=${application.id}`}
              >
                Mở chat
              </Link>
            )}
          </article>
        );
      })}
    </div>
  );
}
