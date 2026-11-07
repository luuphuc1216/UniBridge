"use client";

import { useActionState } from "react";
import {
  saveTeamProfileAction,
  type TeamProfileActionState,
} from "@/app/student/team/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type TeamProfile = {
  name: string;
  university: string;
  description: string;
  experience: string;
  relevantProducts: string;
  achievements: string;
  interests: string;
  memberships: {
    isLinked: boolean;
    name: string;
    major: string;
    title: string;
    isLead: boolean;
  }[];
  skills: { skill: { name: string } }[];
};

export function TeamProfileForm({ team }: { team: TeamProfile | null }) {
  const [state, formAction, isPending] = useActionState<
    TeamProfileActionState,
    FormData
  >(saveTeamProfileAction, { error: null });
  const linkedMembers =
    team?.memberships.filter(({ isLinked }) => isLinked) ?? [];
  const displayOnlyMembers = team?.memberships
    .filter(({ isLinked }) => !isLinked)
    .map(({ name, major }) => `${name}|${major}`)
    .join("\n") ?? "";

  return (
    <form action={formAction} className="space-y-6 sm:space-y-8">
      {state.error && (
        <p
          className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm leading-6 text-destructive"
          role="alert"
        >
          {state.error}
        </p>
      )}
      <fieldset className="space-y-5 rounded-2xl border border-border bg-background p-4 sm:p-6">
        <legend className="px-2 text-base font-semibold tracking-tight">
          Thông tin cơ bản
        </legend>
        <p className="text-sm leading-6 text-muted-foreground">
          Các thông tin có nhãn <span className="font-medium text-foreground">Bắt buộc</span> cần được điền để lưu hồ sơ.
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="grid min-w-0 gap-2 text-sm font-medium">
            <span className="flex flex-wrap items-center justify-between gap-2">
              Tên nhóm
              <span className="text-xs font-normal text-primary">Bắt buộc</span>
            </span>
            <Input
              className="text-base motion-reduce:transition-none sm:text-sm"
              defaultValue={team?.name ?? ""}
              maxLength={100}
              name="name"
              required
            />
            <span className="text-xs font-normal text-muted-foreground">
              Tối đa 100 ký tự.
            </span>
          </label>
          <label className="grid min-w-0 gap-2 text-sm font-medium">
            <span className="flex flex-wrap items-center justify-between gap-2">
              Trường đại học
              <span className="text-xs font-normal text-primary">Bắt buộc</span>
            </span>
            <Input
              className="text-base motion-reduce:transition-none sm:text-sm"
              defaultValue={team?.university ?? ""}
              maxLength={160}
              name="university"
              required
            />
            <span className="text-xs font-normal text-muted-foreground">
              Tối đa 160 ký tự.
            </span>
          </label>
          <label className="grid gap-2 text-sm font-medium sm:col-span-2">
            <span className="flex flex-wrap items-center justify-between gap-2">
              Giới thiệu nhóm
              <span className="text-xs font-normal text-primary">Bắt buộc</span>
            </span>
            <Textarea
              className="min-h-32 text-base motion-reduce:transition-none sm:text-sm"
              defaultValue={team?.description ?? ""}
              maxLength={3000}
              name="description"
              required
            />
            <span className="text-xs font-normal text-muted-foreground">
              Mô tả ngắn gọn năng lực, định hướng và cách nhóm có thể đóng góp.
              Tối đa 3.000 ký tự.
            </span>
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-5 rounded-2xl border border-border bg-background p-4 sm:p-6">
        <legend className="px-2 text-base font-semibold tracking-tight">
          Thành viên nhóm
        </legend>
        <label className="grid gap-2 text-sm font-medium">
          <span className="flex flex-wrap items-center justify-between gap-2">
            Danh sách thành viên
            <span className="text-xs font-normal text-muted-foreground">
              {linkedMembers.length > 0 ? "Không bắt buộc" : "Bắt buộc"}
            </span>
          </span>
          <Textarea
            className="min-h-36 font-mono text-base leading-6 motion-reduce:transition-none sm:text-sm"
            defaultValue={displayOnlyMembers}
            name="members"
            placeholder={"Nguyễn Văn A | Công nghệ thông tin\nTrần Thị B | Marketing"}
            required={linkedMembers.length === 0}
          />
        </label>
        <div className="space-y-2 rounded-xl bg-muted/50 p-4 text-sm leading-6 text-muted-foreground">
          <p>
            Mỗi dòng nhập một thành viên chỉ có thông tin hiển thị theo định dạng{" "}
            <code className="rounded bg-background px-1.5 py-0.5 font-medium text-foreground">
              Tên thành viên | Chuyên ngành
            </code>
            .
          </p>
          <p>
            Ví dụ: Nguyễn Văn A | Công nghệ thông tin. Tối đa 20 thành viên
            trong nhóm. Thành viên đầu tiên được ghi nhận là trưởng nhóm nếu
            chưa có thành viên đã liên kết tài khoản giữ vai trò này.
          </p>
        </div>
        {linkedMembers.length > 0 && (
          <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-4">
            <p className="text-sm font-semibold">Thành viên đã liên kết tài khoản</p>
            <p className="text-sm leading-6 text-muted-foreground">
              Danh sách này được giữ nguyên khi cập nhật hồ sơ và không chỉnh sửa
              từ ô nhập thành viên.
            </p>
            <ul className="space-y-2">
              {linkedMembers.map((member, index) => (
                <li
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-background px-3 py-2 text-sm"
                  key={`${member.name}-${member.major}-${index}`}
                >
                  <span>
                    <span className="font-medium">{member.name}</span>
                    <span className="text-muted-foreground"> · {member.major}</span>
                  </span>
                  <span className="text-muted-foreground">{member.title}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </fieldset>

      <fieldset className="space-y-5 rounded-2xl border border-border bg-background p-4 sm:p-6">
        <legend className="px-2 text-base font-semibold tracking-tight">
          Kỹ năng
        </legend>
        <label className="grid gap-2 text-sm font-medium">
          <span className="flex flex-wrap items-center justify-between gap-2">
            Kỹ năng của nhóm
            <span className="text-xs font-normal text-muted-foreground">
              Không bắt buộc
            </span>
          </span>
          <Textarea
            className="min-h-28 text-base motion-reduce:transition-none sm:text-sm"
            defaultValue={team?.skills.map(({ skill }) => skill.name).join(", ") ?? ""}
            name="skills"
            placeholder={"Phân tích dữ liệu\nThiết kế giao diện"}
          />
          <span className="text-xs font-normal text-muted-foreground">
            Nhập nhiều kỹ năng, phân tách bằng dấu phẩy hoặc xuống dòng.
          </span>
        </label>
      </fieldset>

      <fieldset className="space-y-5 rounded-2xl border border-border bg-background p-4 sm:p-6">
        <legend className="px-2 text-base font-semibold tracking-tight">
          Kinh nghiệm và sản phẩm
        </legend>
        <div className="grid gap-5">
          <label className="grid gap-2 text-sm font-medium">
            <span className="flex flex-wrap items-center justify-between gap-2">
              Kinh nghiệm và dự án đã thực hiện
              <span className="text-xs font-normal text-muted-foreground">
                Không bắt buộc
              </span>
            </span>
            <Textarea
              className="min-h-32 text-base motion-reduce:transition-none sm:text-sm"
              defaultValue={team?.experience ?? ""}
              name="experience"
              placeholder="Chia sẻ kinh nghiệm hoặc các dự án tiêu biểu nhóm đã thực hiện."
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            <span className="flex flex-wrap items-center justify-between gap-2">
              Sản phẩm liên quan hoặc đường dẫn portfolio
              <span className="text-xs font-normal text-muted-foreground">
                Không bắt buộc
              </span>
            </span>
            <Textarea
              className="min-h-28 text-base motion-reduce:transition-none sm:text-sm"
              defaultValue={team?.relevantProducts ?? ""}
              name="relevantProducts"
              placeholder="Mô tả sản phẩm liên quan hoặc dán đường dẫn để doanh nghiệp tham khảo."
            />
          </label>
        </div>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <fieldset className="min-w-0 space-y-4 rounded-2xl border border-border bg-background p-4 sm:p-6">
          <legend className="px-2 text-base font-semibold tracking-tight">
            Thành tích
          </legend>
          <label className="grid gap-2 text-sm font-medium">
            <span className="flex flex-wrap items-center justify-between gap-2">
              Thành tích hoặc chứng chỉ
              <span className="text-xs font-normal text-muted-foreground">
                Không bắt buộc
              </span>
            </span>
            <Textarea
              className="min-h-32 text-base motion-reduce:transition-none sm:text-sm"
              defaultValue={team?.achievements ?? ""}
              name="achievements"
              placeholder="Ghi các thành tích, giải thưởng hoặc chứng chỉ liên quan."
            />
          </label>
        </fieldset>
        <fieldset className="min-w-0 space-y-4 rounded-2xl border border-border bg-background p-4 sm:p-6">
          <legend className="px-2 text-base font-semibold tracking-tight">
            Lĩnh vực quan tâm
          </legend>
          <label className="grid gap-2 text-sm font-medium">
            <span className="flex flex-wrap items-center justify-between gap-2">
              Lĩnh vực nhóm quan tâm
              <span className="text-xs font-normal text-muted-foreground">
                Không bắt buộc
              </span>
            </span>
            <Textarea
              className="min-h-32 text-base motion-reduce:transition-none sm:text-sm"
              defaultValue={team?.interests ?? ""}
              name="interests"
              placeholder="Chia sẻ các lĩnh vực nhóm muốn tìm hiểu hoặc tham gia."
            />
          </label>
        </fieldset>
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Bạn có thể cập nhật thông tin này sau khi tạo hồ sơ.
        </p>
        <Button
          className="w-full motion-reduce:transition-none sm:w-auto"
          disabled={isPending}
          type="submit"
        >
          {isPending ? "Đang lưu..." : team ? "Cập nhật hồ sơ nhóm" : "Tạo hồ sơ nhóm"}
        </Button>
      </div>
    </form>
  );
}
