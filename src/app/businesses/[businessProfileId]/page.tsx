import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { ReviewList } from "@/components/reputation/review-list";
import { prisma } from "@/lib/prisma";
import { getBusinessReviewPage } from "@/lib/reputation-data";

export const instant = false;

export default async function BusinessProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ businessProfileId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/dang-nhap");
  const [{ businessProfileId }, { page }] = await Promise.all([params, searchParams]);
  const business = await prisma.businessProfile.findUnique({
    where: { id: businessProfileId },
    select: {
      id: true,
      companyName: true,
      industry: true,
      website: true,
      description: true,
    },
  });
  if (!business) notFound();

  const reviewPage = await getBusinessReviewPage(business.id, Number(page ?? "1"));
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <header className="rounded-2xl border border-border bg-card p-5 sm:p-7">
        <p className="text-sm font-semibold text-primary">{business.industry}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{business.companyName}</h1>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{business.description}</p>
        {business.website && (
          <p className="mt-4 break-all text-sm text-muted-foreground">
            Trang web doanh nghiệp: {business.website}
          </p>
        )}
      </header>
      <ReviewList
        basePath={`/businesses/${business.id}`}
        reviewPage={reviewPage}
        title="Đánh giá từ các nhóm sinh viên"
      />
    </main>
  );
}
