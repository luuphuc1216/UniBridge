import { Skeleton } from "@/components/ui/skeleton";

export default function StudentLoading() {
  return (
    <main
      aria-label="Đang tải nội dung sinh viên"
      className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 sm:py-10 lg:px-8"
      role="status"
    >
      <span className="sr-only">Đang tải nội dung...</span>
      <div className="space-y-3">
        <Skeleton className="h-4 w-36 motion-reduce:animate-none" />
        <Skeleton className="h-10 w-64 max-w-full motion-reduce:animate-none" />
        <Skeleton className="h-5 w-full max-w-xl motion-reduce:animate-none" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton
            className="h-36 rounded-2xl motion-reduce:animate-none"
            key={index}
          />
        ))}
      </div>
      <Skeleton className="h-72 rounded-2xl motion-reduce:animate-none" />
    </main>
  );
}
