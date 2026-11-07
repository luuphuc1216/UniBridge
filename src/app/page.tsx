import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import {
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  Check,
  ClipboardList,
  GraduationCap,
  Lightbulb,
  Network,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import type { ReactNode } from "react";
import { auth } from "@/auth";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LandingNavigation } from "@/components/landing/landing-navigation";
import { UniBridgeLogo } from "@/components/brand/unibridge-logo";
import { prisma } from "@/lib/prisma";
import { PROBLEM_ACCEPTING_APPLICATION_STATUSES } from "@/lib/problem-workflow";
import { getRoleHome } from "@/lib/roles";

export default function Home() {
  return (
    <div className="min-h-screen overflow-hidden bg-background" data-landing-page="">
      <style>{`html:has([data-landing-page]) { scroll-behavior: auto !important; }`}</style>
      <a
        className="sr-only z-50 rounded-lg bg-card px-4 py-3 text-sm font-semibold text-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:ring-2 focus:ring-primary"
        href="#main-content"
      >
        Bỏ qua đến nội dung chính
      </a>
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:h-[4.5rem] lg:px-8">
          <UniBridgeLogo />
          <LandingNavigation />
          <Suspense
            fallback={
              <div className="flex items-center gap-2">
                <Link
                  className="hidden rounded-full px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:inline-flex"
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
            }
          >
            <HomeActions />
          </Suspense>
        </div>
      </header>

      <main id="main-content">
        <section
          aria-labelledby="hero-title"
          className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 md:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:px-8 lg:py-24"
          id="trang-chu"
        >
          <div>
            <Badge className="gap-2 border-0 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
              <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
              Kết nối tri thức với thực tiễn
            </Badge>
            <h1
              className="mt-6 max-w-2xl text-[2.5rem] font-semibold leading-[1.12] tracking-[-0.04em] sm:text-5xl lg:text-6xl"
              id="hero-title"
            >
              Kết nối tri thức.
              <span className="mt-1 block text-primary">Giải quyết bài toán thực tế.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              UniBridge kết nối doanh nghiệp đang tìm kiếm giải pháp với những nhóm sinh viên
              có năng lực và mong muốn biến kiến thức thành giá trị thực tiễn.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <ArrowLink href="/dang-ky" label="Tham gia UniBridge" />
              <Link
                className={buttonVariants({
                  variant: "outline",
                  size: "lg",
                  className: "rounded-full",
                })}
                href="/dang-nhap"
              >
                Đăng nhập
              </Link>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Chọn vai trò Doanh nghiệp hoặc Sinh viên khi tạo tài khoản.
            </p>
          </div>

          <div
            aria-label="Minh họa doanh nghiệp kết nối với nhóm sinh viên"
            className="relative mx-auto w-full max-w-xl"
            role="img"
          >
            <div
              aria-hidden="true"
              className="absolute -inset-4 -z-10 rounded-[2rem] bg-accent/70 sm:-inset-6"
            />
            <div className="rounded-[1.75rem] bg-brand-navy p-5 text-white shadow-xl shadow-brand-navy/10 sm:rounded-[2rem] sm:p-8">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/75 sm:text-sm">
                  Minh họa cách kết nối
                </p>
                <Network aria-hidden="true" className="size-5 text-white/75" />
              </div>
              <div className="mt-6 grid gap-3 sm:mt-8 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                <div className="rounded-2xl border border-white/15 bg-white/10 p-4 sm:p-5">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-white/10">
                    <BriefcaseBusiness aria-hidden="true" className="size-5" />
                  </div>
                  <p className="mt-4 text-sm font-semibold sm:text-base">Bài toán thực tế</p>
                  <p className="mt-1 text-xs leading-5 text-white/70 sm:text-sm">
                    Nhu cầu và mục tiêu từ doanh nghiệp
                  </p>
                </div>
                <div className="flex justify-center py-1 text-white/70">
                  <ArrowRight aria-hidden="true" className="hidden size-5 sm:block" />
                  <ArrowRight aria-hidden="true" className="size-5 rotate-90 sm:hidden" />
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 p-4 sm:p-5">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-white/10">
                    <UsersRound aria-hidden="true" className="size-5" />
                  </div>
                  <p className="mt-4 text-sm font-semibold sm:text-base">Nhóm sinh viên</p>
                  <p className="mt-1 text-xs leading-5 text-white/70 sm:text-sm">
                    Năng lực và góc nhìn đa dạng
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-foreground sm:mt-4 sm:px-5 sm:py-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <Lightbulb aria-hidden="true" className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Đề xuất hướng giải quyết</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Kết nối nhu cầu với ý tưởng phù hợp
                  </p>
                </div>
                <ArrowUpRight aria-hidden="true" className="ml-auto size-5 text-primary" />
              </div>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="intro-title"
          className="scroll-mt-24 bg-card py-16 sm:py-20 lg:py-24"
          id="gioi-thieu"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="Khoảng cách cần được kết nối"
              title="Nhu cầu thực tế và cơ hội học hỏi chưa phải lúc nào cũng gặp nhau."
              description="UniBridge hướng đến việc đưa bài toán của doanh nghiệp đến gần hơn với năng lực và góc nhìn của sinh viên."
              id="intro-title"
            />
            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:mt-12">
              <Card className="rounded-3xl border-border/80 p-6 shadow-none sm:p-8">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <BriefcaseBusiness aria-hidden="true" className="size-6" />
                </div>
                <h3 className="mt-5 text-xl font-semibold tracking-tight">Doanh nghiệp có bài toán</h3>
                <p className="mt-3 leading-7 text-muted-foreground">
                  Nhiều vấn đề cần được nghiên cứu hoặc giải quyết, nhưng việc tìm đúng nhóm
                  có kỹ năng và góc nhìn phù hợp có thể là một trở ngại.
                </p>
              </Card>
              <Card className="rounded-3xl border-border/80 p-6 shadow-none sm:p-8">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
                  <GraduationCap aria-hidden="true" className="size-6" />
                </div>
                <h3 className="mt-5 text-xl font-semibold tracking-tight">
                  Sinh viên cần trải nghiệm thực tế
                </h3>
                <p className="mt-3 leading-7 text-muted-foreground">
                  Kiến thức và năng lực của sinh viên có thể được phát huy qua cơ hội tiếp cận
                  những vấn đề thực tế, ngoài phạm vi bài tập trên lớp.
                </p>
              </Card>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="audiences-title"
          className="scroll-mt-24 py-16 sm:py-20 lg:py-24"
          id="doi-tuong"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="Một nền tảng, hai phía giá trị"
              title="Kết nối đúng nhu cầu, mở ra cơ hội cùng phát triển."
              description="Mỗi bên tham gia với vai trò riêng, cùng hướng đến những giải pháp có ích trong thực tế."
              id="audiences-title"
              centered
            />
            <div className="mt-10 grid gap-5 lg:mt-12 lg:grid-cols-2">
              <AudienceCard
                id="doanh-nghiep"
                icon={<BriefcaseBusiness aria-hidden="true" className="size-6" />}
                title="Dành cho doanh nghiệp"
                description="Chia sẻ vấn đề cần giải quyết và tiếp cận đề xuất từ các nhóm sinh viên."
                benefits={[
                  "Đăng bài toán với mục tiêu và yêu cầu cụ thể.",
                  "Xem hồ sơ, kỹ năng và hướng tiếp cận của các nhóm.",
                  "Trao đổi, đánh giá đề xuất và lựa chọn nhóm phù hợp.",
                ]}
              />
              <AudienceCard
                id="sinh-vien"
                icon={<GraduationCap aria-hidden="true" className="size-6" />}
                title="Dành cho sinh viên"
                description="Tìm bài toán phù hợp với năng lực nhóm và trình bày cách bạn có thể đóng góp."
                benefits={[
                  "Xây dựng hồ sơ năng lực chung của nhóm.",
                  "Khám phá bài toán và gửi Profile + Approach.",
                  "Trao đổi và phát triển giải pháp khi được doanh nghiệp lựa chọn.",
                ]}
                student
              />
            </div>
          </div>
        </section>

        <Suspense
          fallback={
            <section aria-label="Bài toán đang mở" className="bg-card py-16 sm:py-20 lg:py-24">
              <p className="mx-auto max-w-7xl px-4 text-sm text-muted-foreground sm:px-6 lg:px-8" role="status">
                Đang tải bài toán đang mở...
              </p>
            </section>
          }
        >
          <FeaturedProblems />
        </Suspense>

        <section
          aria-labelledby="process-title"
          className="scroll-mt-24 bg-card py-16 sm:py-20 lg:py-24"
          id="quy-trinh"
        >
          <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16 lg:px-8">
            <div>
              <SectionHeading
                eyebrow="Từ bài toán đến giải pháp"
                title="Tám bước từ nhu cầu đến giá trị thực tế."
                description="Quy trình đi từ kiểm duyệt và kết nối phù hợp đến giai đoạn thử nghiệm; Paid Implementation chỉ diễn ra khi doanh nghiệp quyết định tiếp tục."
                id="process-title"
              />
              <div className="mt-7 flex items-start gap-3 rounded-2xl border border-border bg-background p-4">
                <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
                <p className="text-sm leading-6 text-muted-foreground">
                  Doanh nghiệp gửi lời mời hợp tác; nhóm cần xác nhận trước khi được lựa chọn
                  chính thức. Proposal/Prototype được kiểm tra bàn giao trước khi doanh nghiệp
                  đánh giá.
                </p>
              </div>
            </div>
            <ol className="divide-y divide-border border-y border-border">
              <ProcessStep
                number="01"
                icon={<ClipboardList aria-hidden="true" className="size-5" />}
                title="Doanh nghiệp đăng bài toán"
                description="Mô tả vấn đề, mục tiêu, yêu cầu và thời gian dự kiến."
              />
              <ProcessStep
                number="02"
                icon={<ShieldCheck aria-hidden="true" className="size-5" />}
                title="Bài toán được kiểm duyệt"
                description="Nội dung được xem xét theo quy định trước khi hiển thị công khai."
              />
              <ProcessStep
                number="03"
                icon={<Network aria-hidden="true" className="size-5" />}
                title="Sinh viên khám phá bài toán phù hợp"
                description="Nhóm có thể tham khảo danh sách và gợi ý bài toán theo năng lực, mối quan tâm."
              />
              <ProcessStep
                number="04"
                icon={<GraduationCap aria-hidden="true" className="size-5" />}
                title="Nhóm gửi Profile + Approach"
                description="Nhóm trình bày hồ sơ năng lực và hướng tiếp cận bài toán."
              />
              <ProcessStep
                number="05"
                icon={<UsersRound aria-hidden="true" className="size-5" />}
                title="Doanh nghiệp mời nhóm; nhóm xác nhận"
                description="Nhóm được lựa chọn chính thức sau khi chấp nhận lời mời hợp tác."
              />
              <ProcessStep
                number="06"
                icon={<Lightbulb aria-hidden="true" className="size-5" />}
                title="Nhóm xây dựng Proposal hoặc Prototype"
                description="Sản phẩm bàn giao được kiểm tra tính đầy đủ trước khi chuyển cho doanh nghiệp đánh giá."
              />
              <ProcessStep
                number="07"
                icon={<BriefcaseBusiness aria-hidden="true" className="size-5" />}
                title="Doanh nghiệp cân nhắc Paid Implementation"
                description="Chỉ tiếp tục sang triển khai có trả phí khi doanh nghiệp quyết định và hai bên thống nhất."
              />
              <ProcessStep
                number="08"
                icon={<Check aria-hidden="true" className="size-5" />}
                title="Theo dõi Milestone, nghiệm thu và đánh giá"
                description="Các bên theo dõi tiến độ và kết quả theo thỏa thuận; thông tin giao dịch trong MVP là mô phỏng."
              />
            </ol>
          </div>
        </section>

        <section
          aria-labelledby="transparency-title"
          className="py-16 sm:py-20 lg:py-24"
          id="minh-bach"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="Minh bạch trong từng bước hợp tác"
              title="Theo dõi rõ hồ sơ, phạm vi và tiến độ."
              description="UniBridge hỗ trợ ghi nhận các bước làm việc đã có trong nền tảng; mỗi quyết định vẫn dựa trên thỏa thuận và đánh giá của các bên."
              id="transparency-title"
              centered
            />
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["Kiểm duyệt bài toán", "Bài toán được xem xét trước khi công khai."],
                ["Hồ sơ hai phía", "Thông tin nhóm và đề xuất được lưu cùng bài toán liên quan."],
                ["Phạm vi đã thống nhất", "Hồ sơ thử nghiệm và thỏa thuận ghi nhận mục tiêu, đầu ra."],
                ["Theo dõi tiến độ", "Milestone giúp các bên theo dõi công việc theo thỏa thuận."],
                ["Lịch sử bàn giao", "Các lần nộp Proposal và kết quả kiểm tra được lưu lại."],
                ["Đánh giá hai chiều", "Đánh giá được hiển thị khi có dữ liệu thực tế."],
              ].map(([title, description]) => (
                <Card className="rounded-2xl p-5 shadow-none sm:p-6" key={title}>
                  <ShieldCheck aria-hidden="true" className="size-5 text-primary" />
                  <h3 className="mt-4 font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section
          aria-labelledby="faq-title"
          className="scroll-mt-24 bg-card py-16 sm:py-20 lg:py-24"
          id="cau-hoi"
        >
          <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16 lg:px-8">
            <SectionHeading
              eyebrow="Câu hỏi thường gặp"
              title="Thông tin rõ ràng trước khi bắt đầu."
              description="Tìm hiểu cách tham gia, các giai đoạn dự án và cơ chế chi phí của MVP."
              id="faq-title"
            />
            <div className="grid content-start gap-3">
              <details className="group rounded-2xl border border-border bg-background p-4 sm:p-5">
                <summary className="cursor-pointer rounded-lg text-base font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
                  UniBridge hoạt động như thế nào?
                </summary>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Doanh nghiệp đăng bài toán để kiểm duyệt; sinh viên khám phá và gửi
                  Profile + Approach. Doanh nghiệp có thể mời một nhóm, và nhóm cần
                  chấp nhận lời mời trước khi hai bên bắt đầu giai đoạn tiếp theo.
                </p>
              </details>
              <details className="group rounded-2xl border border-border bg-background p-4 sm:p-5">
                <summary className="cursor-pointer rounded-lg text-base font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
                  Sinh viên tham gia bằng cách nào?
                </summary>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Tạo tài khoản sinh viên, hoàn thiện hồ sơ nhóm, sau đó tìm bài toán
                  phù hợp và gửi hồ sơ ứng tuyển kèm hướng tiếp cận.
                </p>
              </details>
              <details className="group rounded-2xl border border-border bg-background p-4 sm:p-5">
                <summary className="cursor-pointer rounded-lg text-base font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
                  UniBridge có thu phí doanh nghiệp khi sử dụng nền tảng không?
                </summary>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Trong phiên bản MVP hiện tại, doanh nghiệp được cung cấp 2 lượt
                  đăng bài toán miễn phí. Khi sử dụng hết lượt miễn phí, doanh nghiệp
                  có thể mua thêm lượt đăng với mức giá đang được cấu hình là
                  99.000đ/lượt hoặc lựa chọn gói Premium 699.000đ/quý. Đây là mức giá
                  cấu hình trong MVP, chưa được xác nhận là giá thương mại chính thức.
                </p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Ngoài chi phí sử dụng nền tảng, nếu doanh nghiệp quyết định tiếp tục
                  triển khai giải pháp sau giai đoạn đề xuất hoặc thử nghiệm, dự án có
                  thể chuyển sang Paid Implementation. Khi đó, chi phí thực hiện và
                  phí dịch vụ nền tảng sẽ được xác định theo thỏa thuận của dự án.
                  Tỷ lệ 15% từng được đề xuất trong mô hình doanh thu không phải khoản
                  đã thu thực tế. Chức năng thanh toán Paid Implementation trong MVP
                  hiện chỉ mang tính mô phỏng, chưa thực hiện giao dịch tiền thật.
                </p>
              </details>
              <details className="group rounded-2xl border border-border bg-background p-4 sm:p-5">
                <summary className="cursor-pointer rounded-lg text-base font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
                  Profile + Approach là gì?
                </summary>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Profile giới thiệu năng lực và thành viên của nhóm; Approach trình
                  bày cách nhóm hiểu bài toán, hướng giải quyết và kế hoạch dự kiến.
                </p>
              </details>
              <details className="group rounded-2xl border border-border bg-background p-4 sm:p-5">
                <summary className="cursor-pointer rounded-lg text-base font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
                  Prototype khác Paid Implementation như thế nào?
                </summary>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Prototype hoặc Solution Proposal thuộc giai đoạn đề xuất và thử
                  nghiệm. Paid Implementation là giai đoạn triển khai tiếp theo nếu
                  doanh nghiệp quyết định thực hiện và hai bên thống nhất phạm vi.
                </p>
              </details>
              <details className="group rounded-2xl border border-border bg-background p-4 sm:p-5">
                <summary className="cursor-pointer rounded-lg text-base font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
                  Thanh toán Paid Implementation được thực hiện ra sao?
                </summary>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Chi phí và điều kiện thanh toán được xác định theo thỏa thuận dự án.
                  Trong MVP hiện tại, trạng thái giao dịch chỉ được mô phỏng; UniBridge
                  chưa tự động thu hoặc chuyển tiền thật.
                </p>
              </details>
              <details className="group rounded-2xl border border-border bg-background p-4 sm:p-5">
                <summary className="cursor-pointer rounded-lg text-base font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
                  Quyền sở hữu sản phẩm được xác định như thế nào?
                </summary>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Quyền sở hữu và quyền sử dụng sản phẩm cần được các bên thống nhất
                  trong thỏa thuận áp dụng cho dự án.
                </p>
              </details>
            </div>
          </div>
        </section>

        <section className="px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <div className="mx-auto flex max-w-7xl flex-col gap-7 rounded-[1.75rem] bg-brand-navy px-6 py-10 text-white sm:rounded-[2rem] sm:px-10 sm:py-12 lg:flex-row lg:items-center lg:justify-between lg:px-14">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
                Bắt đầu kết nối
              </p>
              <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                Ý tưởng của bạn có thể tạo nên giá trị thực tế.
              </h2>
              <p className="mt-3 leading-7 text-white/75">
                Doanh nghiệp có thể chia sẻ bài toán; sinh viên có thể khám phá cơ hội phù hợp.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Link
                className={buttonVariants({
                  size: "lg",
                  className: "rounded-full bg-white text-brand-navy hover:bg-white/90",
                })}
                href="/business/problems/new"
              >
                Đăng bài toán ngay
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
              <Link
                className="inline-flex h-12 items-center justify-center rounded-full border border-white/25 px-5 text-base font-medium text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-navy"
                href="/student/problems"
              >
                Khám phá cơ hội
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
              UniBridge kết nối doanh nghiệp có bài toán thực tế với nhóm sinh viên mong muốn
              đưa kiến thức vào thực tiễn.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-3">
            <Link className="rounded-sm text-white/75 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" href="#gioi-thieu">
              Về UniBridge
            </Link>
            <Link className="rounded-sm text-white/75 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" href="#doanh-nghiep">
              Doanh nghiệp
            </Link>
            <Link className="rounded-sm text-white/75 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" href="#sinh-vien">
              Sinh viên
            </Link>
            <Link className="rounded-sm text-white/75 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" href="#quy-trinh">
              Quy trình
            </Link>
            <Link className="rounded-sm text-white/75 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" href="/dang-nhap">
              Đăng nhập
            </Link>
            <Link className="rounded-sm text-white/75 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" href="/dang-ky">
              Đăng ký
            </Link>
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

async function FeaturedProblems() {
  await connection();
  const where = {
    status: { in: [...PROBLEM_ACCEPTING_APPLICATION_STATUSES] },
    hiddenByAdmin: false,
    applications: { none: { status: "SELECTED" } },
  };
  const [problems, fields] = await Promise.all([
    prisma.problem.findMany({
      where,
      orderBy: [{ approvedAt: "desc" }, { createdAt: "desc" }],
      take: 3,
      select: {
        id: true,
        title: true,
        field: true,
        description: true,
        expectedDuration: true,
        budgetMin: true,
        budgetMax: true,
        businessProfile: { select: { companyName: true } },
        skills: {
          take: 4,
          select: { skill: { select: { name: true } } },
        },
      },
    }),
    prisma.problem.findMany({
      where,
      select: { field: true },
      distinct: ["field"],
      orderBy: { field: "asc" },
      take: 6,
    }),
  ]);
  const money = new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  });

  return (
    <>
      <section
        aria-labelledby="featured-problems-title"
        className="scroll-mt-24 py-16 sm:py-20 lg:py-24"
        id="bai-toan"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Cơ hội đang mở"
            title="Bài toán thực tế từ doanh nghiệp."
            description="Các bài toán dưới đây đang nhận hồ sơ và có thể thay đổi theo dữ liệu được đăng trên UniBridge."
            id="featured-problems-title"
          />
          {problems.length ? (
            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {problems.map((problem) => (
                <Card className="flex min-w-0 flex-col rounded-2xl p-5 shadow-none sm:p-6" key={problem.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge className="max-w-full whitespace-normal break-words" variant="outline">
                      {problem.field}
                    </Badge>
                    <Badge variant="success">Đang nhận hồ sơ</Badge>
                  </div>
                  <h3 className="mt-4 break-words text-lg font-semibold">{problem.title}</h3>
                  <p className="mt-1 break-words text-sm text-muted-foreground">
                    {problem.businessProfile.companyName}
                  </p>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">
                    {problem.description}
                  </p>
                  <dl className="mt-4 grid gap-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Thời gian</dt>
                      <dd className="min-w-0 break-words text-right font-medium">
                        {problem.expectedDuration}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Ngân sách tham khảo</dt>
                      <dd className="min-w-0 break-words text-right font-medium">
                        {problem.budgetMin !== null && problem.budgetMax !== null
                          ? `${money.format(problem.budgetMin)} – ${money.format(problem.budgetMax)}`
                          : problem.budgetMin !== null
                            ? `Từ ${money.format(problem.budgetMin)}`
                            : problem.budgetMax !== null
                              ? `Đến ${money.format(problem.budgetMax)}`
                              : "Chưa công bố"}
                      </dd>
                    </div>
                  </dl>
                  {problem.skills.length > 0 && (
                    <ul aria-label="Kỹ năng liên quan" className="mt-4 flex flex-wrap gap-2">
                      {problem.skills.map(({ skill }) => (
                        <li key={skill.name}>
                          <Badge className="max-w-full whitespace-normal break-words" variant="secondary">
                            {skill.name}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link
                    className="mt-auto inline-flex min-h-11 items-center gap-2 pt-5 text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    href={`/student/problems/${problem.id}`}
                  >
                    Xem chi tiết
                    <ArrowUpRight aria-hidden="true" className="size-4" />
                  </Link>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="mt-8 rounded-2xl border-dashed p-6 shadow-none sm:p-8">
              <h3 className="font-semibold">Hiện chưa có bài toán đang mở để giới thiệu.</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Danh sách này chỉ hiển thị bài toán đã được duyệt và đang nhận hồ sơ.
              </p>
              <Link
                className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                href="/student/problems"
              >
                Khám phá bài toán
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </Card>
          )}
        </div>
      </section>

      <section
        aria-labelledby="fields-title"
        className="scroll-mt-24 bg-card py-14 sm:py-16 lg:py-20"
        id="linh-vuc"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Khám phá cơ hội"
            title="Theo lĩnh vực nhóm quan tâm."
            description="Lĩnh vực hiển thị dựa trên bài toán đang mở thực tế; không có số lượng ước tính."
            id="fields-title"
          />
          {fields.length > 0 ? (
            <ul className="mt-7 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {fields.map(({ field }, index) => (
                <li key={field}>
                  <Link
                    className="group flex min-h-14 items-center gap-4 rounded-xl border border-border bg-background px-4 py-3 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"
                    href={`/student/problems?field=${encodeURIComponent(field)}`}
                  >
                    <span className="text-sm font-semibold tabular-nums text-primary">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1 break-words font-medium">{field}</span>
                    <ArrowUpRight
                      aria-hidden="true"
                      className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-6 text-sm text-muted-foreground">
              Các lĩnh vực sẽ xuất hiện khi có bài toán đang mở.
            </p>
          )}
        </div>
      </section>
    </>
  );
}

async function HomeActions() {
  await connection();
  const session = await auth();

  if (session?.user) {
    return (
      <Link
        className={buttonVariants({
          size: "default",
          className: "h-10 rounded-full px-4",
        })}
        href={getRoleHome(session.user.role)}
      >
        Vào dashboard
      </Link>
    );
  }

  return (
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
  );
}

function ArrowLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      className={buttonVariants({
        size: "lg",
        className: "group h-12 rounded-full pl-6 pr-2",
      })}
      href={href}
    >
      {label}
      <span className="grid size-8 place-items-center rounded-full bg-primary-foreground/15">
        <ArrowRight
          aria-hidden="true"
          className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
        />
      </span>
    </Link>
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
  description: string;
  id: string;
  centered?: boolean;
}) {
  return (
    <div className={centered ? "mx-auto max-w-3xl text-center" : "max-w-2xl"}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
        {eyebrow}
      </p>
      <h2
        className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.03em] sm:text-4xl"
        id={id}
      >
        {title}
      </h2>
      <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
        {description}
      </p>
    </div>
  );
}

function AudienceCard({
  id,
  icon,
  title,
  description,
  benefits,
  student = false,
}: {
  id: string;
  icon: ReactNode;
  title: string;
  description: string;
  benefits: string[];
  student?: boolean;
}) {
  return (
    <Card
      className={`scroll-mt-24 rounded-3xl p-6 shadow-sm transition-[transform,box-shadow] duration-200 [@media(hover:hover)]:hover:shadow-md motion-reduce:transition-none sm:p-8 ${
        student ? "bg-accent/40" : "bg-card"
      }`}
      id={id}
    >
      <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="mt-5 text-xl font-semibold tracking-tight sm:text-2xl">{title}</h3>
      <p className="mt-3 leading-7 text-muted-foreground">{description}</p>
      <ul className="mt-6 grid gap-3">
        {benefits.map((benefit) => (
          <li className="flex items-start gap-3 text-sm leading-6 sm:text-base" key={benefit}>
            <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-success" />
            <span>{benefit}</span>
          </li>
        ))}
      </ul>
      <Link
        className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        href="/dang-ky"
      >
        Tham gia với vai trò {student ? "sinh viên" : "doanh nghiệp"}
        <ArrowUpRight aria-hidden="true" className="size-4" />
      </Link>
    </Card>
  );
}

function ProcessStep({
  number,
  icon,
  title,
  description,
}: {
  number: string;
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <li className="group flex gap-4 py-6 transition-colors [@media(hover:hover)]:hover:bg-muted/50 sm:gap-6 sm:px-4">
      <span className="w-10 shrink-0 pt-1 text-sm font-semibold tabular-nums text-primary">
        {number}
      </span>
      <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </span>
      <div>
        <h3 className="text-base font-semibold sm:text-lg">{title}</h3>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground sm:text-base">
          {description}
        </p>
      </div>
      <ArrowUpRight
        aria-hidden="true"
        className="ml-auto mt-1 size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none"
      />
    </li>
  );
}
