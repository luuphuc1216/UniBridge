import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Compass,
  Handshake,
  Lightbulb,
  Network,
  TrendingUp,
} from "lucide-react";
import { LandingNavigation } from "@/components/landing/landing-navigation";
import { UniBridgeLogo } from "@/components/brand/unibridge-logo";
import { buttonVariants } from "@/components/ui/button";
import { teamMembers } from "@/data/team-members";

export const metadata: Metadata = {
  title: "Về chúng tôi | UniBridge",
  description:
    "Tìm hiểu tầm nhìn, sứ mệnh, giá trị và đội ngũ phát triển UniBridge.",
};

const coreValues = [
  {
    title: "Kết nối",
    description:
      "Tạo cầu nối giữa sinh viên và doanh nghiệp, mở ra cơ hội hợp tác và phát triển.",
    icon: Network,
  },
  {
    title: "Sáng tạo",
    description:
      "Khuyến khích những ý tưởng mới, cách tiếp cận mới và giải pháp sáng tạo.",
    icon: Lightbulb,
  },
  {
    title: "Thực tiễn",
    description:
      "Hướng đến giải quyết những vấn đề thực tế của doanh nghiệp bằng kiến thức và năng lực của sinh viên.",
    icon: Compass,
  },
  {
    title: "Phát triển",
    description:
      "Cùng học hỏi, tích lũy kinh nghiệm và tạo ra những giá trị lâu dài.",
    icon: TrendingUp,
  },
] as const;

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("");
}

function hasTeamPhoto(image: string) {
  return existsSync(join(process.cwd(), "public", image.replace(/^\/+/, "")));
}

export default function AboutPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-background">
      <a
        className="sr-only z-50 rounded-lg bg-card px-4 py-3 text-sm font-semibold text-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:ring-2 focus:ring-primary"
        href="#main-content"
      >
        Bỏ qua đến nội dung chính
      </a>

      <header className="sticky top-0 z-30 border-b border-border/80 bg-background">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:h-[4.5rem] lg:px-8">
          <UniBridgeLogo />
          <LandingNavigation homePagePrefix />
          <div className="flex items-center gap-1">
            <Link
              className="hidden rounded-full px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:inline-flex"
              href="/dang-nhap"
            >
              Đăng nhập
            </Link>
            <Link
              className={buttonVariants({
                size: "default",
                className: "h-10 rounded-full px-4",
              })}
              href="/dang-ky"
            >
              <span className="sm:hidden">Đăng ký</span>
              <span className="hidden sm:inline">Tạo tài khoản</span>
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content">
        <section
          aria-labelledby="about-title"
          className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-28"
        >
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
              <Network aria-hidden="true" className="size-4" />
              Về UniBridge
            </p>
            <h1
              className="mt-6 text-4xl font-semibold leading-tight tracking-[-0.04em] text-foreground sm:text-5xl lg:text-6xl"
              id="about-title"
            >
              Kết nối tri thức.
              <span className="mt-1 block text-primary">
                Kiến tạo giá trị thực tiễn.
              </span>
            </h1>
            <p className="mt-6 text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              UniBridge là nền tảng kết nối doanh nghiệp với sinh viên, tạo môi
              trường để những bài toán thực tế từ doanh nghiệp gặp gỡ kiến thức,
              kỹ năng và sự sáng tạo của sinh viên.
            </p>
          </div>

          <div className="mt-10 grid gap-8 rounded-[1.75rem] border border-border bg-card p-6 shadow-sm sm:p-8 lg:grid-cols-[1fr_0.8fr] lg:items-center lg:gap-12 lg:p-10">
            <div>
              <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                Cùng biến kiến thức thành giá trị
              </h2>
              <ul className="mt-6 space-y-4">
                {[
                  "Doanh nghiệp có thể đưa ra các vấn đề, nhu cầu và bài toán thực tế cần giải quyết.",
                  "Sinh viên có cơ hội tiếp cận các dự án thực tiễn, vận dụng kiến thức đã học và đề xuất giải pháp.",
                  "Hai bên có thể kết nối, trao đổi và hợp tác để tạo ra những giá trị thiết thực.",
                ].map((item) => (
                  <li
                    className="flex gap-3 text-sm leading-6 text-muted-foreground sm:text-base"
                    key={item}
                  >
                    <span
                      aria-hidden="true"
                      className="mt-2 size-2 shrink-0 rounded-full bg-primary"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl bg-brand-navy p-6 text-white sm:p-8">
              <Handshake aria-hidden="true" className="size-8 text-white/80" />
              <p className="mt-5 text-lg font-semibold leading-7 sm:text-xl">
                UniBridge hướng đến việc thu hẹp khoảng cách giữa kiến thức học
                thuật và môi trường kinh doanh thực tế.
              </p>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="vision-title"
          className="bg-card py-16 sm:py-20 lg:py-24"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="Định hướng"
              title="Tầm nhìn và sứ mệnh"
              id="vision-title"
            />
            <div className="mt-10 grid gap-5 md:grid-cols-2">
              <article className="rounded-3xl border border-border bg-background p-6 sm:p-8">
                <span className="text-sm font-semibold uppercase tracking-[0.12em] text-primary">
                  Tầm nhìn
                </span>
                <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                  Hướng đến xây dựng một nền tảng kết nối hiệu quả giữa môi
                  trường đại học và doanh nghiệp, nơi tri thức, ý tưởng và năng
                  lực của sinh viên được ứng dụng vào những vấn đề thực tế.
                </p>
              </article>
              <article className="rounded-3xl border border-primary/15 bg-accent/60 p-6 sm:p-8">
                <span className="text-sm font-semibold uppercase tracking-[0.12em] text-primary">
                  Sứ mệnh
                </span>
                <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                  Tạo điều kiện để doanh nghiệp tiếp cận những ý tưởng và giải
                  pháp từ sinh viên; đồng thời giúp sinh viên tích lũy kinh
                  nghiệm, phát triển năng lực và tạo ra giá trị thực tiễn.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="team-title"
          className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24"
          id="doi-ngu"
        >
          <SectionHeading
            eyebrow="Những người đứng sau UniBridge"
            title="Đội ngũ phát triển UniBridge"
            description="Chúng tôi là đội ngũ sinh viên cùng chung mong muốn thu hẹp khoảng cách giữa kiến thức học thuật và nhu cầu thực tế của doanh nghiệp. Với tinh thần kết nối, sáng tạo và không ngừng học hỏi, chúng tôi cùng nhau xây dựng UniBridge trở thành cầu nối giữa sinh viên và doanh nghiệp."
            id="team-title"
          />
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {teamMembers.map((member, index) => {
              const isTeamLead = member.role === "Trưởng nhóm";
              const photoExists = hasTeamPhoto(member.image);

              return (
                <article
                  className={`overflow-hidden rounded-3xl border bg-card shadow-sm transition-shadow hover:shadow-md ${
                    isTeamLead ? "border-primary/40" : "border-border"
                  }`}
                  key={member.name}
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-accent">
                    {photoExists ? (
                      <Image
                        alt={`Ảnh ${member.name}`}
                        className="object-cover"
                        fill
                        priority={index === 0}
                        sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 25vw"
                        src={member.image}
                      />
                    ) : (
                      <div
                        aria-label={`Ảnh chân dung ${member.name} sẽ được bổ sung`}
                        className="grid size-full place-items-center bg-gradient-to-br from-accent to-primary/10"
                        role="img"
                      >
                        <span className="grid size-20 place-items-center rounded-full border border-white/80 bg-card/80 text-2xl font-semibold tracking-wide text-brand-navy shadow-sm">
                          {getInitials(member.name)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    {isTeamLead && (
                      <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                        Trưởng nhóm
                      </span>
                    )}
                    <h3 className="mt-3 text-lg font-semibold tracking-tight">
                      {member.name}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {member.role}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section
          aria-labelledby="values-title"
          className="bg-card py-16 sm:py-20 lg:py-24"
          id="gia-tri"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="Điều chúng tôi tin tưởng"
              title="Giá trị cốt lõi"
              id="values-title"
              centered
            />
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {coreValues.map(({ title, description, icon: Icon }) => (
                <article
                  className="rounded-2xl border border-border bg-background p-5 transition-shadow hover:shadow-md sm:p-6"
                  key={title}
                >
                  <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          aria-labelledby="join-title"
          className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24"
          id="dong-hanh"
        >
          <div className="rounded-[1.75rem] bg-brand-navy px-6 py-10 text-white sm:px-10 sm:py-14 lg:px-16">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-white/70">
              Cùng kết nối và phát triển
            </p>
            <h2
              className="mt-4 max-w-3xl text-3xl font-semibold leading-tight tracking-[-0.03em] sm:text-4xl"
              id="join-title"
            >
              Cùng UniBridge tạo nên những giá trị mới
            </h2>
            <p className="mt-5 max-w-3xl text-base leading-7 text-white/75 sm:text-lg sm:leading-8">
              Mỗi bài toán thực tế là một cơ hội để kết nối, học hỏi và phát
              triển. Hãy cùng UniBridge xây dựng những giá trị mới từ sự hợp
              tác giữa doanh nghiệp và sinh viên.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                className={buttonVariants({
                  size: "lg",
                  className:
                    "group h-12 justify-between rounded-full bg-white pl-6 pr-2 text-brand-navy hover:bg-white/90",
                })}
                href="/dang-ky"
              >
                Dành cho doanh nghiệp
                <span className="grid size-8 place-items-center rounded-full bg-primary/10">
                  <ArrowRight
                    aria-hidden="true"
                    className="size-4 transition-transform group-hover:translate-x-0.5"
                  />
                </span>
              </Link>
              <Link
                className="inline-flex h-12 items-center justify-between gap-4 rounded-full border border-white/30 px-6 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-navy"
                href="/dang-ky"
              >
                Dành cho sinh viên
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-brand-navy text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 md:grid-cols-[1fr_auto] md:items-start lg:px-8 lg:py-14">
          <div className="max-w-md">
            <UniBridgeLogo inverse />
            <p className="mt-3 text-sm font-medium text-white/80">
              Connect Ideas. Create Impact.
            </p>
            <p className="mt-3 text-sm leading-6 text-white/65">
              UniBridge kết nối doanh nghiệp có bài toán thực tế với nhóm sinh
              viên mong muốn đưa kiến thức vào thực tiễn.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-3">
            <FooterLink href="/#gioi-thieu">Về UniBridge</FooterLink>
            <FooterLink href="/#doanh-nghiep">Doanh nghiệp</FooterLink>
            <FooterLink href="/#sinh-vien">Sinh viên</FooterLink>
            <FooterLink href="/#quy-trinh">Quy trình</FooterLink>
            <FooterLink href="/dang-nhap">Đăng nhập</FooterLink>
            <FooterLink href="/dang-ky">Đăng ký</FooterLink>
          </div>
        </div>
        <div className="border-t border-white/15">
          <p className="mx-auto max-w-7xl px-4 py-4 text-xs text-white/55 sm:px-6 lg:px-8">
            © UniBridge
          </p>
        </div>
      </footer>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  id,
  centered = false,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  id: string;
  centered?: boolean;
}) {
  return (
    <div className={centered ? "mx-auto max-w-2xl text-center" : "max-w-3xl"}>
      <p className="text-sm font-semibold uppercase tracking-[0.12em] text-primary">
        {eyebrow}
      </p>
      <h2
        className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl"
        id={id}
      >
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
          {description}
        </p>
      )}
    </div>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      className="rounded-sm text-white/75 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      href={href}
    >
      {children}
    </Link>
  );
}
