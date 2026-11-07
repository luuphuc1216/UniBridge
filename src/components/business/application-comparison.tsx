"use client";

import Link from "next/link";
import { useActionState, type ReactNode } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Clock3,
  FileText,
  Link2,
  MessageSquareText,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import {
  sendInvitationAction,
  updateApplicationReviewAction,
  generateApplicationExplanationAction,
  type ProblemActionState,
  type AiExplanationState,
} from "@/app/business/problems/actions";
import type { TeamReputation } from "@/lib/reputation";
import {
  formatInvitationExpiry,
  getApplicationStatusDisplay,
} from "@/lib/application-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

type ApplicationCardData = {
  id: string;
  submittedAtLabel: string;
  submittedAtIso: string;
  profileSnapshotVersion: number;
  hasProfileSnapshot: boolean;
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
  attachments: {
    id: string;
    originalName: string;
    sizeBytes: number;
  }[];
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
    members: {
      name: string;
      major: string;
      title?: string;
      isLead?: boolean;
    }[];
    projects: { title: string }[];
  };
  recommendationScore: number;
  recommendationReasons: string[];
};

type ApplicationComparisonProps = {
  problemId: string;
  applications: ApplicationCardData[];
  problemSkills: string[];
  problemStatus: string;
  hasPendingInvitation: boolean;
  aiRemaining: { daily: number; monthly: number };
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

function getSafeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && url.hostname
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function ProfileField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 border-t border-border/80 pt-3">
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm leading-6">{children}</dd>
    </div>
  );
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
    <form action={formAction} className="space-y-3">
      <input name="problemId" type="hidden" value={problemId} />
      <input name="applicationId" type="hidden" value={applicationId} />
      {state.error && (
        <p
          className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm leading-6 text-destructive"
          role="alert"
        >
          {state.error}
        </p>
      )}
      <Button
        className="min-h-11 w-full motion-reduce:transition-none"
        disabled={isPending || disabled}
        type="submit"
      >
        <span aria-live="polite">
          {isPending ? "Đang gửi lời mời..." : "Gửi lời mời hợp tác"}
        </span>
      </Button>
      <p className="text-xs leading-5 text-muted-foreground">
        Nhóm cần phản hồi lời mời trước khi được ghi nhận là đã lựa chọn.
      </p>
    </form>
  );
}

function ReviewForm({
  problemId,
  application,
}: {
  problemId: string;
  application: ApplicationCardData;
}) {
  const [state, formAction, isPending] = useActionState<
    ProblemActionState,
    FormData
  >(updateApplicationReviewAction, { error: null });
  const checkboxId = `needs-review-${application.id}`;
  const noteId = `review-note-${application.id}`;
  const noteHelpId = `review-note-help-${application.id}`;

  return (
    <form action={formAction} className="space-y-4">
      <input name="problemId" type="hidden" value={problemId} />
      <input name="applicationId" type="hidden" value={application.id} />
      <div>
        <label
          className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium"
          htmlFor={checkboxId}
        >
          <input
            className="size-4 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            defaultChecked={application.needsReview}
            id={checkboxId}
            name="needsReview"
            type="checkbox"
          />
          Đánh dấu cần xem xét
        </label>
      </div>
      <div>
        <label className="text-sm font-semibold" htmlFor={noteId}>
          Ghi chú nội bộ
        </label>
        <textarea
          aria-describedby={noteHelpId}
          className="mt-2 min-h-28 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-base leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:text-sm"
          defaultValue={application.businessReviewNote ?? ""}
          id={noteId}
          maxLength={2000}
          name="businessReviewNote"
          placeholder="Ghi chú về hồ sơ để doanh nghiệp tiện theo dõi"
        />
        <p className="mt-1 text-xs text-muted-foreground" id={noteHelpId}>
          Tối đa 2.000 ký tự.
        </p>
      </div>
      {state.error && (
        <p className="text-sm leading-6 text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <Button
        className="min-h-11 motion-reduce:transition-none"
        disabled={isPending}
        type="submit"
        variant="outline"
      >
        <span aria-live="polite">
          {isPending ? "Đang lưu..." : "Lưu ghi chú"}
        </span>
      </Button>
    </form>
  );
}

function AiExplanation({
  problemId,
  applications,
  remaining,
}: {
  problemId: string;
  applications: ApplicationCardData[];
  remaining: { daily: number; monthly: number };
}) {
  const [state, formAction, isPending] = useActionState<
    AiExplanationState,
    FormData
  >(generateApplicationExplanationAction, { error: null });
  const hasExplanations = Boolean(
    state.explanations && Object.keys(state.explanations).length > 0,
  );

  return (
    <Card>
      <CardContent className="p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0">
              <CardTitle>Giải thích Recommendation bằng AI</CardTitle>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Tạo phần giải thích tham khảo cho mức độ phù hợp của các nhóm
                trong danh sách. Kết quả không thay thế việc doanh nghiệp tự
                đánh giá hồ sơ.
              </p>
            </div>
          </div>
          <div className="w-full shrink-0 sm:w-auto">
            <form action={formAction}>
              <input name="problemId" type="hidden" value={problemId} />
              <Button
                className="min-h-11 w-full motion-reduce:transition-none sm:w-auto"
                disabled={
                  isPending || remaining.daily === 0 || remaining.monthly === 0
                }
                type="submit"
                variant="outline"
              >
                {isPending ? "Đang phân tích..." : "AI giải thích Recommendation"}
              </Button>
            </form>
            <p className="mt-2 text-xs text-muted-foreground">
              Còn {remaining.daily} lượt hôm nay / {remaining.monthly} lượt tháng này
            </p>
          </div>
        </div>
        {isPending && (
          <p aria-live="polite" className="mt-4 text-sm text-muted-foreground">
            Đang phân tích danh sách hồ sơ...
          </p>
        )}
        {state.error && (
          <p
            className="mt-4 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm leading-6 text-destructive"
            role="alert"
          >
            {state.error}
          </p>
        )}
        {hasExplanations && (
          <section aria-label="Giải thích Recommendation từ AI" className="mt-5">
            <p aria-live="polite" className="text-sm font-semibold text-success">
              Đã tạo giải thích tham khảo cho hồ sơ.
            </p>
            <ul className="mt-3 grid gap-3 lg:grid-cols-2">
              {applications.map((application) => {
                const explanation = state.explanations?.[application.id];
                return explanation ? (
                  <li
                    className="min-w-0 rounded-xl border border-border bg-muted/30 p-4 text-sm leading-6"
                    key={application.id}
                  >
                    <p className="font-semibold">{application.team.name}</p>
                    <p className="mt-1 break-words text-muted-foreground">
                      {explanation}
                    </p>
                  </li>
                ) : null;
              })}
            </ul>
          </section>
        )}
      </CardContent>
    </Card>
  );
}

function ReputationSummary({ reputation }: { reputation: TeamReputation }) {
  return (
    <section aria-label="Reputation hiện tại" className="border-t border-border pt-5">
      <h4 className="flex items-center gap-2 text-sm font-semibold">
        <Star aria-hidden="true" className="size-4 text-primary" />
        Reputation hiện tại
      </h4>
      <dl className="mt-3 grid gap-x-5 gap-y-4 sm:grid-cols-2">
        <ProfileField label="Điểm Reputation">
          {reputation.score === null ? "Chưa có dữ liệu" : `${reputation.score} / 100`}
        </ProfileField>
        <ProfileField label="Đánh giá">
          {reputation.ratingAverage === null
            ? "Chưa có đánh giá"
            : `${reputation.ratingAverage.toFixed(1)} / 5`}
          {" · "}
          {reputation.ratingCount} lượt
        </ProfileField>
        <ProfileField label="Dự án hoàn tất">
          {reputation.completedProjectCount}
        </ProfileField>
        <ProfileField label="Tỷ lệ hoàn thành">
          {reputation.completionRate === null
            ? "Chưa có dữ liệu"
            : `${reputation.completionRate}%`}
        </ProfileField>
        <ProfileField label="Tỷ lệ đúng hạn">
          {reputation.onTimeRate === null
            ? "Chưa có dữ liệu"
            : `${reputation.onTimeRate}%`}
        </ProfileField>
      </dl>
    </section>
  );
}

function ApplicationCard({
  application,
  index,
  problemId,
  problemSkills,
  canSelect,
  hasPendingInvitation,
}: {
  application: ApplicationCardData;
  index: number;
  problemId: string;
  problemSkills: string[];
  canSelect: boolean;
  hasPendingInvitation: boolean;
}) {
  const matchedSkills = application.team.skills.filter((skill) =>
    problemSkills.includes(skill),
  );
  const approachDetails: [string, string][] = [
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
  const approachLinks = Array.isArray(application.approachLinks)
    ? application.approachLinks
    : [];
  const safeApproachLinks = approachLinks.flatMap((link, index) => {
    if (typeof link !== "string") return [];
    const safeUrl = getSafeHttpUrl(link);
    return safeUrl ? [{ label: link, href: safeUrl, key: `${link}-${index}` }] : [];
  });
  const statusVariant =
    statusDisplay.tone === "success"
      ? "success"
      : statusDisplay.tone === "danger"
        ? "destructive"
        : statusDisplay.tone === "pending"
          ? "warning"
          : statusDisplay.tone === "muted"
            ? "secondary"
            : "outline";

  return (
    <Card className="min-w-0 overflow-hidden">
      <header className="border-b border-border bg-muted/30 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">Nhóm {index + 1}</Badge>
              {application.needsReview && (
                <Badge variant="warning">Cần xem xét</Badge>
              )}
            </div>
            <h2 className="mt-3 break-words text-xl font-bold tracking-tight sm:text-2xl">
              <Link
                className="rounded-sm hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                href={`/teams/${application.team.id}`}
              >
                {application.team.name}
              </Link>
            </h2>
            <p className="mt-1 break-words text-sm text-muted-foreground">
              {application.team.university}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant={statusVariant}>{statusDisplay.label}</Badge>
              {hasPendingApplicationInvitation && application.invitation && (
                <Badge variant="warning">
                  {formatInvitationExpiry(application.invitation.expiresAt)}
                </Badge>
              )}
            </div>
            {["DECLINED", "EXPIRED", "NOT_SELECTED"].includes(application.status) &&
              application.invitation?.responseReason && (
                <p className="mt-2 break-words text-sm text-muted-foreground">
                  Lý do phản hồi: {application.invitation.responseReason}
                </p>
              )}
          </div>
          <div
            aria-label={`Điểm phù hợp Recommendation: ${application.recommendationScore}`}
            className="flex shrink-0 items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3"
          >
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
              #{index + 1}
            </span>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Điểm phù hợp
              </p>
              <p className="text-xl font-bold tabular-nums text-foreground">
                {application.recommendationScore}
              </p>
            </div>
          </div>
        </div>
        {application.recommendationReasons.length > 0 && (
          <div className="mt-5 border-t border-border pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Lý do Recommendation
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {application.recommendationReasons.map((reason) => (
                <li key={reason}>
                  <Badge variant="outline" className="whitespace-normal">
                    {reason}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
      </header>

      <CardContent className="space-y-6 p-5 sm:p-6">
        <section aria-label="Thông tin ứng tuyển">
          <dl className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
            <ProfileField label="Thời gian gửi">
              <span className="inline-flex items-start gap-2">
                <CalendarDays aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <time dateTime={application.submittedAtIso}>
                  {application.submittedAtLabel}
                </time>
              </span>
            </ProfileField>
            <ProfileField label="Thời gian dự kiến">
              <span className="inline-flex items-start gap-2">
                <Clock3 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                {application.estimatedDuration}
              </span>
            </ProfileField>
            <ProfileField label="Chi phí đề xuất">
              <span className="font-semibold">
                {formatCurrency(application.proposedBudget)}
              </span>
            </ProfileField>
          </dl>
        </section>

        <section aria-labelledby={`profile-heading-${application.id}`} className="border-t border-border pt-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h3
                className="text-base font-semibold"
                id={`profile-heading-${application.id}`}
              >
                Profile gửi kèm ứng tuyển
              </h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {application.hasProfileSnapshot
                  ? `Dữ liệu snapshot phiên bản ${application.profileSnapshotVersion}; các trường snapshot còn thiếu giữ nguyên fallback hiện có.`
                  : "Snapshot chưa có dữ liệu; trang đang dùng fallback hồ sơ hiện tại theo cách xử lý hiện có."}
              </p>
            </div>
            <Link
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              href={`/teams/${application.team.id}`}
            >
              Xem hồ sơ nhóm hiện tại
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
          <p className="mt-4 text-xs font-semibold text-muted-foreground">
            Giới thiệu nhóm
          </p>
          <p className="mt-1 break-words whitespace-pre-wrap text-sm leading-6">
            {application.team.description || "Chưa cập nhật mô tả nhóm"}
          </p>
          <dl className="mt-4 grid gap-x-5 gap-y-4 sm:grid-cols-2">
            <ProfileField label="Kỹ năng phù hợp với bài toán">
              {matchedSkills.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {matchedSkills.map((skill) => (
                    <li key={skill}>
                      <Badge variant="success">{skill}</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                "Chưa có kỹ năng trùng khớp"
              )}
            </ProfileField>
            <ProfileField label="Các kỹ năng khác">
              {application.team.skills.length > 0
                ? application.team.skills
                    .filter((skill) => !matchedSkills.includes(skill))
                    .join(", ") || "Tất cả kỹ năng đều phù hợp"
                : "Chưa cập nhật"}
            </ProfileField>
            <ProfileField label="Thành viên, chuyên ngành và vai trò">
              {application.team.members.length > 0 ? (
                <ul className="space-y-2">
                  {application.team.members.map((member, memberIndex) => (
                    <li
                      className="break-words"
                      key={`${member.name}-${member.major}-${memberIndex}`}
                    >
                      <span className="font-medium">{member.name}</span>
                      <span className="text-muted-foreground">
                        {" · "}
                        {member.title ||
                          (member.isLead ? "Trưởng nhóm" : "Thành viên")}
                        {" · "}
                        {member.major || "Chưa cập nhật chuyên ngành"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                "Chưa cập nhật"
              )}
            </ProfileField>
            <ProfileField label="Kinh nghiệm">
              {application.team.experience || "Chưa cập nhật"}
            </ProfileField>
            <ProfileField label="Sản phẩm liên quan">
              <span className="whitespace-pre-wrap">
                {application.team.relevantProducts || "Chưa cập nhật"}
              </span>
            </ProfileField>
            <ProfileField label="Thành tích và chứng chỉ">
              <span className="whitespace-pre-wrap">
                {application.team.achievements || "Chưa cập nhật"}
              </span>
            </ProfileField>
            <ProfileField label="Lĩnh vực quan tâm">
              <span className="whitespace-pre-wrap">
                {application.team.interests || "Chưa cập nhật"}
              </span>
            </ProfileField>
            <ProfileField label="Dự án hiện tại của nhóm">
              <span className="text-xs text-muted-foreground">
                Thông tin này lấy từ hồ sơ nhóm hiện tại, không thuộc snapshot ứng tuyển.
              </span>
              <p className="mt-1">
                {application.team.projects.map(({ title }) => title).join(", ") ||
                  "Chưa có"}
              </p>
            </ProfileField>
          </dl>
          {application.team.reputation && (
            <div className="mt-5">
              <ReputationSummary reputation={application.team.reputation} />
            </div>
          )}
        </section>

        <section
          aria-labelledby={`approach-heading-${application.id}`}
          className="border-t border-border pt-5"
        >
          <h3
            className="text-base font-semibold"
            id={`approach-heading-${application.id}`}
          >
            Approach đã gửi
          </h3>
          {hasStructuredApproach ? (
            <dl className="mt-3 grid gap-x-5 gap-y-4 sm:grid-cols-2">
              {approachDetails.map(([label, value]) => (
                <ProfileField key={label} label={label}>
                  <span className="whitespace-pre-wrap">
                    {value || "Chưa cập nhật"}
                  </span>
                </ProfileField>
              ))}
            </dl>
          ) : (
            <p className="mt-3 break-words whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
              {application.approach || "Chưa cập nhật Approach"}
            </p>
          )}
        </section>

        <section
          aria-labelledby={`evidence-heading-${application.id}`}
          className="border-t border-border pt-5"
        >
          <h3
            className="text-base font-semibold"
            id={`evidence-heading-${application.id}`}
          >
            Liên kết và tài liệu minh chứng
          </h3>
          {safeApproachLinks.length > 0 ? (
            <div className="mt-3">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Link2 aria-hidden="true" className="size-4 text-muted-foreground" />
                Liên kết tham khảo
              </p>
              <ul className="mt-2 space-y-2">
                {safeApproachLinks.map(({ label, href, key }) => (
                  <li className="min-w-0" key={key}>
                    <a
                      className="inline-flex min-h-10 max-w-full items-center gap-2 break-all text-sm text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      href={href}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      <span className="break-all">{label}</span>
                      <ArrowUpRight aria-hidden="true" className="size-4 shrink-0" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Chưa có liên kết tham khảo.
            </p>
          )}
          {application.attachments.length > 0 ? (
            <div className="mt-4">
              <p className="flex items-center gap-2 text-sm font-medium">
                <FileText aria-hidden="true" className="size-4 text-muted-foreground" />
                Tài liệu minh họa đã gửi
              </p>
              <ul className="mt-2 space-y-2">
                {application.attachments.map((attachment) => (
                  <li
                    className="flex min-w-0 flex-col gap-1 rounded-xl border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                    key={attachment.id}
                  >
                    <a
                      className="inline-flex min-h-10 min-w-0 items-center gap-2 break-all text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      href={`/api/approach/attachments/${attachment.id}`}
                    >
                      <FileText aria-hidden="true" className="size-4 shrink-0" />
                      <span className="break-all">{attachment.originalName}</span>
                    </a>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {(attachment.sizeBytes / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Chưa có tài liệu minh họa được gửi.
            </p>
          )}
        </section>

        <section
          aria-labelledby={`actions-heading-${application.id}`}
          className="border-t border-border pt-5"
        >
          <h3
            className="text-base font-semibold"
            id={`actions-heading-${application.id}`}
          >
            Thao tác và ghi chú nội bộ
          </h3>
          <div className="mt-4">
            {canInvite ? (
              <SelectTeamForm
                applicationId={application.id}
                problemId={problemId}
              />
            ) : hasPendingApplicationInvitation ? (
              <p className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm leading-6 text-foreground">
                Đang chờ nhóm xác nhận hợp tác trước hạn phản hồi được hiển thị
                phía trên.
              </p>
            ) : canSelect &&
              application.status === "SUBMITTED" &&
              hasPendingInvitation ? (
              <p className="rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm leading-6 text-muted-foreground">
                Bài toán đang có một lời mời chờ xác nhận. Bạn chỉ có thể mời
                nhóm khác sau khi lời mời này được từ chối hoặc hết hạn.
              </p>
            ) : (
              <p className="rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm leading-6 text-muted-foreground">
                Bài toán đã chọn nhóm hoặc không còn nhận lựa chọn.
              </p>
            )}
          </div>
          <div className="mt-5 rounded-xl border border-border p-4 sm:p-5">
            <ReviewForm application={application} problemId={problemId} />
          </div>
          {canOpenChat && (
            <Link
              className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
              href={`/business/problems/${problemId}/workspace?applicationId=${application.id}`}
            >
              <MessageSquareText aria-hidden="true" className="size-4" />
              Mở cuộc trò chuyện
            </Link>
          )}
        </section>
      </CardContent>
    </Card>
  );
}

export function ApplicationComparison({
  problemId,
  applications,
  problemSkills,
  problemStatus,
  hasPendingInvitation,
  aiRemaining,
}: ApplicationComparisonProps) {
  const canSelect = ["APPROVED", "PUBLISHED"].includes(problemStatus);

  if (applications.length === 0) {
    return (
      <EmptyState
        className="bg-card"
        description="Hồ sơ ứng tuyển sẽ xuất hiện tại đây khi có nhóm quan tâm bài toán."
        icon={<Users aria-hidden="true" className="size-5" />}
        title="Chưa có nhóm ứng tuyển"
      />
    );
  }

  return (
    <div className="space-y-6">
      <ol
        aria-label="Danh sách hồ sơ ứng tuyển, sắp xếp theo điểm Recommendation"
        className="grid min-w-0 gap-5 xl:grid-cols-2"
      >
        {applications.map((application, index) => (
          <li className="min-w-0" key={application.id}>
            <ApplicationCard
              application={application}
              canSelect={canSelect}
              hasPendingInvitation={hasPendingInvitation}
              index={index}
              problemId={problemId}
              problemSkills={problemSkills}
            />
          </li>
        ))}
      </ol>
      <AiExplanation
        applications={applications}
        problemId={problemId}
        remaining={aiRemaining}
      />
    </div>
  );
}
