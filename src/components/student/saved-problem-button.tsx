import { toggleSavedProblemAction } from "@/app/student/problems/actions";

export function SavedProblemButton({
  problemId,
  isSaved,
}: {
  problemId: string;
  isSaved: boolean;
}) {
  return (
    <form action={toggleSavedProblemAction}>
      <input name="problemId" type="hidden" value={problemId} />
      <button
        className="w-full rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted"
        name="intent"
        type="submit"
        value={isSaved ? "remove" : "save"}
      >
        {isSaved ? "Đã lưu · Bỏ lưu" : "Lưu bài toán"}
      </button>
    </form>
  );
}
