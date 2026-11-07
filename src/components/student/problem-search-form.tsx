import Link from "next/link";
import { searchProblemsAction } from "@/app/student/problems/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

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
      className="grid gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:grid-cols-2 sm:p-5 lg:grid-cols-3"
    >
      <label className="grid gap-1.5 text-sm font-medium sm:col-span-2 lg:col-span-3">
        Từ khóa
        <Input
          className="text-base motion-reduce:transition-none sm:text-sm"
          defaultValue={values.query}
          maxLength={160}
          name="query"
          placeholder="Tên hoặc nội dung bài toán"
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Lĩnh vực
        <Select
          className="text-base motion-reduce:transition-none sm:text-sm"
          defaultValue={values.field}
          name="field"
        >
          <option value="">Tất cả lĩnh vực</option>
          {fields.map((field) => (
            <option key={field} value={field}>
              {field}
            </option>
          ))}
        </Select>
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Kỹ năng
        <Select
          className="text-base motion-reduce:transition-none sm:text-sm"
          defaultValue={values.skill}
          name="skill"
        >
          <option value="">Tất cả kỹ năng</option>
          {skills.map((skill) => (
            <option key={skill} value={skill}>
              {skill}
            </option>
          ))}
        </Select>
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Thời gian dự kiến
        <Select
          className="text-base motion-reduce:transition-none sm:text-sm"
          defaultValue={values.duration}
          name="duration"
        >
          <option value="">Mọi thời lượng</option>
          {durations.map((duration) => (
            <option key={duration} value={duration}>
              {duration}
            </option>
          ))}
        </Select>
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Ngân sách từ (đồng)
        <Input
          className="text-base motion-reduce:transition-none sm:text-sm"
          defaultValue={values.budgetMin}
          min="0"
          name="budgetMin"
          step="100000"
          type="number"
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Ngân sách đến (đồng)
        <Input
          className="text-base motion-reduce:transition-none sm:text-sm"
          defaultValue={values.budgetMax}
          min="0"
          name="budgetMax"
          step="100000"
          type="number"
        />
      </label>
      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
        <Button className="flex-1 motion-reduce:transition-none" type="submit">
          Tìm bài toán
        </Button>
        <Link
          className={cn(
            buttonVariants({ variant: "outline" }),
            "px-4 motion-reduce:transition-none",
          )}
          href="/student/problems"
        >
          Xóa lọc
        </Link>
      </div>
    </form>
  );
}
