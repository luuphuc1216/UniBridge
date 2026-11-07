"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function StudentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Lỗi khi tải khu vực sinh viên:", error);
  }, [error]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <Card className="p-6 text-center sm:p-10">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle aria-hidden="true" className="size-5" />
        </span>
        <h1 className="mt-5 text-2xl font-bold tracking-tight">
          Chưa thể tải nội dung
        </h1>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
          Đã xảy ra lỗi khi tải trang. Bạn có thể thử tải lại; nếu sự cố tiếp
          tục, hãy quay lại sau.
        </p>
        <Button className="mt-6" onClick={reset} type="button">
          Thử tải lại
        </Button>
      </Card>
    </main>
  );
}
