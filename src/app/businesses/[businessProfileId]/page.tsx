import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { ReviewList } from "@/components/reputation/review-list";
import { prisma } from "@/lib/prisma";
import { getBusinessReviewPage } from "@/lib/reputation-data";
import { BusinessLogo } from "@/components/business/business-logo";
import { canViewBusinessPrivateContact } from "@/lib/business-contact-access";

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
      userId: true,
      companyName: true,
      industry: true,
      website: true,
      description: true,
      logo: true,
      industries: true,
      address: true,
      problems: {
        where: { status: { in: ["APPROVED", "PUBLISHED"] }, hiddenByAdmin: false },
        select: { id: true, title: true, field: true },
        orderBy: { approvedAt: "desc" },
      },
    },
  });
  if (!business) notFound();
  const hasSelectedApplication = session.user.role === "STUDENT"
    ? Boolean(await prisma.application.findFirst({
        where: {
          status: "SELECTED",
          problem: { businessProfileId: business.id },
          team: {
            OR: [
              { ownerId: session.user.id },
              { memberships: { some: { studentProfile: { userId: session.user.id } } } },
            ],
          },
        },
        select: { id: true },
      }))
    : false;
  const canViewPrivateContact = canViewBusinessPrivateContact({
    viewer: { userId: session.user.id, role: session.user.role },
    businessOwnerId: business.userId,
    hasSelectedApplication,
  });
  const privateContact = canViewPrivateContact
    ? await prisma.businessProfile.findUnique({
        where: { id: business.id },
        select: { contactEmail: true, phone: true, representative: true },
      })
    : null;

  const reviewPage = await getBusinessReviewPage(business.id, Number(page ?? "1"));
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <header className="rounded-2xl border border-border bg-card p-5 sm:p-7">
        <p className="text-sm font-semibold text-primary">{business.industry}</p>
        {business.logo && <BusinessLogo alt={`Logo ${business.companyName}`} src={business.logo} />}
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{business.companyName}</h1>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{business.description}</p>
        {business.address && <p className="mt-3 text-sm text-muted-foreground">Địa chỉ: {business.address}</p>}
        {business.industries && <p className="mt-2 text-sm text-muted-foreground">Lĩnh vực: {business.industries}</p>}
        {business.website && (
          <p className="mt-4 break-all text-sm text-muted-foreground">
            Trang web doanh nghiệp: {business.website}
          </p>
        )}
        {privateContact && (
          <div className="mt-4 space-y-1 text-sm text-muted-foreground">
            {privateContact.contactEmail && <p>Email liên hệ: {privateContact.contactEmail}</p>}
            {privateContact.phone && <p>Số điện thoại: {privateContact.phone}</p>}
            {privateContact.representative && <p>Người đại diện: {privateContact.representative}</p>}
          </div>
        )}
      </header>
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-7">
        <h2 className="text-lg font-semibold">Bài toán đang mở</h2>
        {business.problems.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Doanh nghiệp chưa có bài toán đang mở.</p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {business.problems.map((problem) => (
              <li key={problem.id}>
                <Link className="font-medium text-primary hover:underline" href={`/student/problems/${problem.id}`}>
                  {problem.title}
                </Link>
                <span className="ml-2 text-sm text-muted-foreground">{problem.field}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <ReviewList
        basePath={`/businesses/${business.id}`}
        reviewPage={reviewPage}
        title="Đánh giá từ các nhóm sinh viên"
      />
    </main>
  );
}
