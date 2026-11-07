import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { ReviewList } from "@/components/reputation/review-list";
import { prisma } from "@/lib/prisma";
import { getBusinessReviewPage } from "@/lib/reputation-data";
import { BusinessLogo } from "@/components/business/business-logo";
import { canViewBusinessPrivateContact } from "@/lib/business-contact-access";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export const instant = false;

function isSafeWebsiteUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

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
  const problemHrefForRole = (problemId: string): string | null => {
    if (session.user.role === "STUDENT") return `/student/problems/${problemId}`;
    if (session.user.role === "ADMIN") return `/admin/problems/${problemId}`;
    if (session.user.role === "BUSINESS" && session.user.id === business.userId) {
      return `/business/problems/${problemId}`;
    }
    return null;
  };

  const hasIntroduction = Boolean(business.description.trim() || business.industries.trim());
  const hasPrivateContact = Boolean(
    privateContact?.contactEmail || privateContact?.phone || privateContact?.representative,
  );
  const websiteIsLink = Boolean(business.website && isSafeWebsiteUrl(business.website));

  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6 sm:space-y-6 sm:px-6 sm:py-10">
      <section aria-labelledby="business-identity-title">
        <Card className="overflow-hidden">
          <div className="grid gap-5 p-5 sm:p-7 md:grid-cols-[auto_minmax(0,1fr)] md:items-center md:gap-7">
            {business.logo && (
              <BusinessLogo
                alt={`Logo ${business.companyName}`}
                showFallback
                src={business.logo}
              />
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-primary">Hồ sơ doanh nghiệp</p>
              <h1
                className="mt-2 break-words text-2xl font-bold leading-tight tracking-tight sm:text-3xl"
                id="business-identity-title"
              >
                {business.companyName}
              </h1>
              <Badge className="mt-3 max-w-full whitespace-normal break-words">
                {business.industry}
              </Badge>
              {(business.address || business.website) && (
                <dl className="mt-5 grid min-w-0 gap-4 text-sm sm:grid-cols-2">
                  {business.address && (
                    <div className="min-w-0">
                      <dt className="font-medium text-foreground">Địa chỉ</dt>
                      <dd className="mt-1 break-words leading-6 text-muted-foreground [overflow-wrap:anywhere]">
                        {business.address}
                      </dd>
                    </div>
                  )}
                  {business.website && (
                    <div className="min-w-0">
                      <dt className="font-medium text-foreground">Website</dt>
                      <dd className="mt-1 break-words leading-6 [overflow-wrap:anywhere]">
                        {websiteIsLink ? (
                          <a
                            className="text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            href={business.website}
                            rel="noopener noreferrer"
                            target="_blank"
                          >
                            {business.website}
                            <span className="sr-only"> (mở trong tab mới)</span>
                          </a>
                        ) : (
                          <span className="text-muted-foreground">{business.website}</span>
                        )}
                      </dd>
                    </div>
                  )}
                </dl>
              )}
            </div>
          </div>
        </Card>
      </section>

      {hasIntroduction && (
        <section aria-labelledby="business-introduction-title">
          <Card>
            <CardContent className="p-5 sm:p-7">
              <h2 className="text-lg font-semibold" id="business-introduction-title">
                Giới thiệu doanh nghiệp
              </h2>
              {business.description.trim() && (
                <p className="mt-3 break-words whitespace-pre-wrap text-sm leading-7 text-muted-foreground [overflow-wrap:anywhere]">
                  {business.description}
                </p>
              )}
              {business.industries.trim() && (
                <div className={business.description.trim() ? "mt-5" : "mt-3"}>
                  <h3 className="text-sm font-semibold">Các lĩnh vực bổ sung</h3>
                  <p className="mt-1 break-words whitespace-pre-wrap text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]">
                    {business.industries}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {privateContact && (
        <section aria-labelledby="business-contact-title">
          <Card>
            <CardContent className="p-5 sm:p-7">
              <h2 className="text-lg font-semibold" id="business-contact-title">
                Thông tin liên hệ
              </h2>
              {hasPrivateContact ? (
                <dl className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">
                  {privateContact.contactEmail && (
                    <div className="min-w-0">
                      <dt className="text-sm text-muted-foreground">Email liên hệ</dt>
                      <dd className="mt-1 break-words text-sm font-medium [overflow-wrap:anywhere]">
                        {privateContact.contactEmail}
                      </dd>
                    </div>
                  )}
                  {privateContact.phone && (
                    <div className="min-w-0">
                      <dt className="text-sm text-muted-foreground">Số điện thoại</dt>
                      <dd className="mt-1 break-words text-sm font-medium [overflow-wrap:anywhere]">
                        {privateContact.phone}
                      </dd>
                    </div>
                  )}
                  {privateContact.representative && (
                    <div className="min-w-0">
                      <dt className="text-sm text-muted-foreground">Người đại diện</dt>
                      <dd className="mt-1 break-words text-sm font-medium [overflow-wrap:anywhere]">
                        {privateContact.representative}
                      </dd>
                    </div>
                  )}
                </dl>
              ) : (
                <EmptyState
                  className="mt-4 px-4 py-8"
                  description="Doanh nghiệp chưa cập nhật thông tin liên hệ."
                  title="Chưa có thông tin liên hệ"
                />
              )}
            </CardContent>
          </Card>
        </section>
      )}

      <section aria-labelledby="business-problems-title">
        <Card>
          <CardContent className="p-5 sm:p-7">
            <h2 className="text-lg font-semibold" id="business-problems-title">
              Bài toán đang mở
            </h2>
            {business.problems.length === 0 ? (
              <EmptyState
                className="mt-4 px-4 py-8"
                description="Doanh nghiệp hiện chưa có bài toán được công khai."
                title="Chưa có bài toán đang mở"
              />
            ) : (
              <ul className="mt-4 grid gap-3">
                {business.problems.map((problem) => {
                  const href = problemHrefForRole(problem.id);
                  return (
                    <li
                      className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-background p-4 sm:flex-row sm:items-start sm:justify-between"
                      key={problem.id}
                    >
                      {href ? (
                        <h3 className="min-w-0 break-words text-base font-semibold leading-6 [overflow-wrap:anywhere]">
                          <Link
                            className="text-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            href={href}
                          >
                            {problem.title}
                          </Link>
                        </h3>
                      ) : (
                        <h3 className="min-w-0 break-words text-base font-semibold leading-6 [overflow-wrap:anywhere]">
                          {problem.title}
                        </h3>
                      )}
                      <Badge className="w-fit max-w-full whitespace-normal break-words" variant="outline">
                        {problem.field}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <ReviewList
        basePath={`/businesses/${business.id}`}
        presentation="public"
        reviewPage={reviewPage}
        title="Đánh giá từ các nhóm sinh viên"
      />
    </main>
  );
}
