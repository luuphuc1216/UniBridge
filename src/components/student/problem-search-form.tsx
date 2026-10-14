import Link from "next/link";
import { searchProblemsAction } from "@/app/student/problems/actions";

export type ProblemSearchValues = {
  query: string;
  field: string;
  skill: string;
  duration: string;
  budgetMin: string;
  budgetMax: string;
};

export function ProblemSearchForm({
  fields,
  skills,
  durations,
  values,
}: {
  fields: string[];
  skills: string[];
  durations: string[];
  values: ProblemSearchValues;
}) {
  return (
    <form
      action={searchProblemsAction}
      className="mt-6 grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <label className="grid gap-1.5 text-sm font-medium sm:col-span-2 lg:col-span-3">
        Từ khóa
        <input
          className="rounded-xl border border-border bg-background px-3 py-2.5 font-normal"
          defaultValue={values.query}
          maxLength={160}
          name="query"
          placeholder="Tên hoặc nội dung bài toán"
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Lĩnh vực
        <select
          className="rounded-xl border border-border bg-background px-3 py-2.5 font-normal"
          defaultValue={values.field}
          name="field"
        >
          <option value="">Tất cả lĩnh vực</option>
          {fields.map((field) => (
            <option key={field} value={field}>
              {field}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Kỹ năng
        <select
          className="rounded-xl border border-border bg-background px-3 py-2.5 font-normal"
          defaultValue={values.skill}
          name="skill"
        >
          <option value="">Tất cả kỹ năng</option>
          {skills.map((skill) => (
            <option key={skill} value={skill}>
              {skill}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Thời gian dự kiến
        <select
          className="rounded-xl border border-border bg-background px-3 py-2.5 font-normal"
          defaultValue={values.duration}
          name="duration"
        >
          <option value="">Mọi thời lượng</option>
          {durations.map((duration) => (
            <option key={duration} value={duration}>
              {duration}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Ngân sách từ (đồng)
        <input
          className="rounded-xl border border-border bg-background px-3 py-2.5 font-normal"
          defaultValue={values.budgetMin}
          min="0"
          name="budgetMin"
          step="100000"
          type="number"
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Ngân sách đến (đồng)
        <input
          className="rounded-xl border border-border bg-background px-3 py-2.5 font-normal"
          defaultValue={values.budgetMax}
          min="0"
          name="budgetMax"
          step="100000"
          type="number"
        />
      </label>
      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
        <button
          className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          type="submit"
        >
          Tìm bài toán
        </button>
        <Link
          className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted"
          href="/student/problems"
        >
          Xóa lọc
        </Link>
      </div>
    </form>
  );
}
