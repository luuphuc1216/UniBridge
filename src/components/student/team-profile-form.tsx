"use client";

import { useActionState } from "react";
import {
  saveTeamProfileAction,
  type TeamProfileActionState,
} from "@/app/student/team/actions";

type TeamProfile = {
  name: string;
  university: string;
  description: string;
  experience: string;
  relevantProducts: string;
  achievements: string;
  interests: string;
  memberships: { name: string; major: string }[];
  skills: { skill: { name: string } }[];
};

export function TeamProfileForm({ team }: { team: TeamProfile | null }) {
  const [state, formAction, isPending] = useActionState<
    TeamProfileActionState,
    FormData
  >(saveTeamProfileAction, { error: null });
  const members =
    team?.memberships
      .map(({ name, major }) => `${name}|${major}`)
      .join("\n") ?? "";

  return (
    <form action={formAction} className="mt-6 space-y-5">
      {state.error && (
        <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">
          Tên nhóm
          <input
            className="rounded-xl border border-border bg-background px-3 py-2.5"
            defaultValue={team?.name ?? ""}
            maxLength={100}
            name="name"
            required
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Trường đại học
          <input
            className="rounded-xl border border-border bg-background px-3 py-2.5"
            defaultValue={team?.university ?? ""}
            maxLength={160}
            name="university"
            required
          />
        </label>
      </div>
      <label className="grid gap-2 text-sm font-medium">
        Giới thiệu nhóm
        <textarea
          className="min-h-24 rounded-xl border border-border bg-background px-3 py-2.5"
          defaultValue={team?.description ?? ""}
          maxLength={3000}
          name="description"
          required
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Thành viên — mỗi dòng nhập <code>Tên thành viên | Chuyên ngành</code>
        <textarea
          className="min-h-28 rounded-xl border border-border bg-background px-3 py-2.5 font-normal"
          defaultValue={members}
          name="members"
          placeholder={"Nguyễn Văn A | Công nghệ thông tin\nTrần Thị B | Marketing"}
          required
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Kỹ năng — ngăn cách bằng dấu phẩy hoặc xuống dòng
        <textarea
          className="min-h-20 rounded-xl border border-border bg-background px-3 py-2.5 font-normal"
          defaultValue={team?.skills.map(({ skill }) => skill.name).join(", ") ?? ""}
          name="skills"
          placeholder="Phân tích dữ liệu, Thiết kế giao diện"
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Kinh nghiệm và dự án đã thực hiện
        <textarea
          className="min-h-24 rounded-xl border border-border bg-background px-3 py-2.5 font-normal"
          defaultValue={team?.experience ?? ""}
          name="experience"
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Sản phẩm liên quan hoặc đường dẫn portfolio
        <textarea
          className="min-h-20 rounded-xl border border-border bg-background px-3 py-2.5 font-normal"
          defaultValue={team?.relevantProducts ?? ""}
          name="relevantProducts"
        />
      </label>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">
          Thành tích hoặc chứng chỉ
          <textarea
            className="min-h-24 rounded-xl border border-border bg-background px-3 py-2.5 font-normal"
            defaultValue={team?.achievements ?? ""}
            name="achievements"
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Lĩnh vực quan tâm
          <textarea
            className="min-h-24 rounded-xl border border-border bg-background px-3 py-2.5 font-normal"
            defaultValue={team?.interests ?? ""}
            name="interests"
          />
        </label>
      </div>
      <button
        className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60 sm:w-auto"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Đang lưu..." : team ? "Cập nhật hồ sơ nhóm" : "Tạo hồ sơ nhóm"}
      </button>
    </form>
  );
}
