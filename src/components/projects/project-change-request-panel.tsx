import { randomUUID } from "node:crypto";
import {
  createProjectChangeRequestAction,
  respondToProjectChangeRequestAction,
} from "@/app/projects/actions";
import { ProjectActionForm } from "@/components/projects/project-action-form";
import {
  getProjectChangeRequestStatusLabel,
  type ProjectChangeKind,
} from "@/lib/project-change-requests";
import { projectReminderConfig } from "@/lib/project-reminder-config";

type ProjectChangeRequestItem = {
  id: string;
  kind: string;
  status: string;
  reason: string;
  payloadJson: string;
  proposedDueAt: Date | null;
  businessAcceptedAt: Date | null;
  teamAcceptedAt: Date | null;
  createdAt: Date;
  milestone: { id: string; title: string } | null;
};

type MilestoneItem = { id: string; title: string; status: string };

const changeKindLabels: Record<string, string> = {
  EXTENSION: "Gia hạn mốc công việc",
  PAUSE: "Tạm dừng dự án",
  RESUME: "Tiếp tục dự án",
  MILESTONE_CANCEL: "Hủy mốc công việc",
  DISPUTE: "Mở bất đồng",
  DISPUTE_RESOLUTION: "Đóng bất đồng",
  PROJECT_TERMINATION: "Chấm dứt dự án",
};

export function ProjectChangeRequestPanel({
  projectId,
  requests,
  milestones,
  role,
  canManage,
}: {
  projectId: string;
  requests: ProjectChangeRequestItem[];
  milestones: MilestoneItem[];
  role: "BUSINESS" | "STUDENT";
  canManage: boolean;
}) {
  const projectRequests = requests.filter((request) => request.kind !== "AGREEMENT_REVISION");
  const openDisputes = milestones.filter(({ status }) => status === "DISPUTED");

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h2 className="text-lg font-semibold">Gia hạn, tạm dừng và phát sinh</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Thay đổi chỉ được áp dụng sau khi doanh nghiệp và chủ nhóm cùng xác nhận. Thanh toán vẫn là mô phỏng.
      </p>

      {canManage && (
        <ProjectActionForm
          action={createProjectChangeRequestAction}
          buttonLabel="Gửi yêu cầu"
          hiddenFields={{ projectId, idempotencyKey: randomUUID() }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span>Loại yêu cầu</span>
              <select className="w-full rounded-lg border border-border bg-background px-3 py-2" name="kind">
                {([
                  "EXTENSION",
                  "PAUSE",
                  "RESUME",
                  "MILESTONE_CANCEL",
                  "DISPUTE",
                  ...(openDisputes.length ? ["DISPUTE_RESOLUTION" as const] : []),
                  "PROJECT_TERMINATION",
                ] satisfies ProjectChangeKind[]).map((kind) => (
                  <option key={kind} value={kind}>{changeKindLabels[kind]}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span>Mốc công việc (nếu áp dụng)</span>
              <select className="w-full rounded-lg border border-border bg-background px-3 py-2" name="milestoneId" defaultValue="">
                <option value="">Không gắn mốc công việc</option>
                {milestones.map(({ id, title, status }) => (
                  <option key={id} value={id}>{title}{status === "DISPUTED" ? " · Có bất đồng" : ""}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span>Hạn mới (gia hạn)</span>
              <input className="w-full rounded-lg border border-border bg-background px-3 py-2" name="dueAt" type="date" />
            </label>
            <label className="space-y-1 text-sm">
              <span>Số ngày tạm dừng (tối đa {projectReminderConfig.pauseMaxDays})</span>
              <input
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
                defaultValue={projectReminderConfig.pauseMaxDays}
                max={projectReminderConfig.pauseMaxDays}
                min={1}
                name="days"
                type="number"
              />
            </label>
          </div>
          <textarea
            className="min-h-20 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
            maxLength={4000}
            name="reason"
            placeholder="Lý do và nội dung đề xuất"
            required
          />
        </ProjectActionForm>
      )}

      <ul className="mt-5 space-y-3">
        {projectRequests.length === 0 ? (
          <li className="text-sm text-muted-foreground">Chưa có yêu cầu thay đổi.</li>
        ) : projectRequests.map((request) => {
          const currentSideAccepted = role === "BUSINESS"
            ? request.businessAcceptedAt !== null
            : request.teamAcceptedAt !== null;
          const canRespond = canManage && request.status === "OPEN" &&
            request.kind !== "DISPUTE" && !currentSideAccepted;
          return (
            <li className="rounded-xl border border-border p-4" key={request.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">
                  {changeKindLabels[request.kind] ?? request.kind}
                  {request.milestone ? ` · ${request.milestone.title}` : ""}
                </h3>
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">
                  {getProjectChangeRequestStatusLabel(request.kind, request.status)}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{request.reason}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Doanh nghiệp: {request.businessAcceptedAt ? "đã xác nhận" : "chưa xác nhận"} ·
                {" "}Chủ nhóm: {request.teamAcceptedAt ? "đã xác nhận" : "chưa xác nhận"}
              </p>
              {request.status === "OPEN" && request.kind === "DISPUTE" && (
                <p className="mt-2 text-sm text-amber-800">
                  Bất đồng đang được ghi nhận; cần tạo yêu cầu đóng bất đồng để hai bên xác nhận.
                </p>
              )}
              {canRespond && (
                <div className="mt-3 flex flex-wrap gap-3">
                  <ProjectActionForm
                    action={respondToProjectChangeRequestAction}
                    buttonLabel="Xác nhận"
                    hiddenFields={{ projectId, requestId: request.id, response: "ACCEPT" }}
                  />
                  <ProjectActionForm
                    action={respondToProjectChangeRequestAction}
                    buttonClassName="rounded-lg border border-rose-300 px-4 py-2.5 text-sm font-semibold text-rose-700 disabled:opacity-60"
                    buttonLabel="Từ chối"
                    hiddenFields={{ projectId, requestId: request.id, response: "REJECT" }}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
