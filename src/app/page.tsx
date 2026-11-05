import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ChevronDown, Lightbulb, Users } from "lucide-react";
import { connection } from "next/server";
import { auth } from "@/auth";
import { getRoleHome } from "@/lib/roles";

const processSteps = [
  ["01", "Đăng bài toán", "Doanh nghiệp mô tả vấn đề thực tế cần giải quyết."],
  ["02", "Kiểm duyệt", "Bài toán được kiểm tra trước khi hiển thị công khai."],
  ["03", "Đề xuất giải pháp", "Nhóm sinh viên gửi Profile + Approach phù hợp."],
  ["04", "Chọn nhóm", "Doanh nghiệp xem xét và gửi lời mời hợp tác."],
  ["05", "Bản thử nghiệm (Prototype)", "Hai bên thống nhất phạm vi thử nghiệm ban đầu."],
  ["06", "Đánh giá kết quả", "Doanh nghiệp phản hồi và quyết định hướng tiếp theo."],
  ["07", "Triển khai có phí", "Chỉ thực hiện khi hai bên thống nhất chuyển giai đoạn."],
  ["08", "Mốc công việc", "Theo dõi bàn giao, nghiệm thu và đánh giá."],
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-background">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link className="text-xl font-bold tracking-tight text-brand-navy" href="/">
            UNIBRIDGE
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground lg:flex">
            <Link className="hover:text-foreground" href="#quy-trinh">Quy trình</Link>
            <Link className="hover:text-foreground" href="#gia-tri">Hai phía giá trị</Link>
            <Link className="hover:text-foreground" href="#faq">FAQ</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Suspense fallback={<Link className="min-h-10 rounded-xl px-3 py-2 text-sm font-semibold text-muted-foreground" href="/dang-nhap">Đăng nhập</Link>}>
              <HomeActions />
            </Suspense>
            <Link className="hidden min-h-10 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 sm:inline-flex sm:items-center" href="/dang-ky">
              Đăng ký
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
        <div>
          <p className="inline-flex rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">Connect Ideas. Create Impact.</p>
          <h1 className="mt-6 max-w-3xl text-4xl font-bold leading-tight tracking-[-0.03em] text-foreground sm:text-5xl lg:text-6xl">
            Kết nối tri thức. <span className="text-primary">Giải quyết bài toán thực tế.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            UniBridge kết nối doanh nghiệp đang tìm kiếm giải pháp với những nhóm sinh viên có năng lực và mong muốn biến kiến thức thành giá trị thực tiễn.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link className="group inline-flex min-h-12 items-center justify-center gap-3 rounded-full bg-primary px-6 font-semibold text-primary-foreground hover:bg-primary/90" href="/dang-ky">
              Tôi là doanh nghiệp <span className="grid size-7 place-items-center rounded-full bg-white/15"><ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" /></span>
            </Link>
            <Link className="inline-flex min-h-12 items-center justify-center rounded-full border border-border bg-card px-6 font-semibold text-foreground hover:bg-muted" href="/dang-ky">
              Tôi là sinh viên
            </Link>
          </div>
        </div>
        <div className="relative rounded-[2rem] bg-brand-navy p-5 text-white shadow-xl sm:p-8">
          <div className="absolute -right-5 -top-5 grid size-16 place-items-center rounded-2xl bg-brand-light text-brand-navy shadow-lg"><Lightbulb /></div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Một không gian chung</p>
          <div className="mt-8 space-y-3">
            <div className="rounded-2xl bg-white p-4 text-brand-navy shadow-lg">
              <div className="flex items-center justify-between"><span className="text-xs font-semibold text-primary">BÀI TOÁN DOANH NGHIỆP</span><span className="rounded-full bg-green-100 px-2 py-1 text-[10px] font-semibold text-green-700">ĐANG MỞ</span></div>
              <p className="mt-3 font-semibold">Tối ưu trải nghiệm khách hàng số</p>
              <p className="mt-1 text-sm text-slate-500">Tìm hướng tiếp cận mới cùng nhóm sinh viên phù hợp.</p>
            </div>
            <div className="ml-8 rounded-2xl border border-white/15 bg-white/10 p-4">
              <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-brand-light/20"><Users className="size-5 text-brand-light" /></span><div><p className="font-semibold">Nhóm sinh viên</p><p className="text-xs text-white/60">Profile + Approach</p></div></div>
            </div>
            <div className="flex items-center justify-center gap-2 py-1 text-xs text-brand-light"><CheckCircle2 className="size-4" /> Kết nối minh bạch từng bước</div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8" id="gia-tri">
        <div className="grid gap-5 md:grid-cols-2">
          <article className="rounded-[2rem] border border-border bg-card p-7 sm:p-9"><span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary"><Lightbulb /></span><h2 className="mt-6 text-2xl font-bold">Dành cho doanh nghiệp</h2><p className="mt-3 leading-7 text-muted-foreground">Biến vấn đề thực tế thành cơ hội tiếp cận góc nhìn mới, hồ sơ nhóm rõ ràng và quy trình hợp tác có cấu trúc.</p><Link className="mt-6 inline-flex items-center gap-2 font-semibold text-primary" href="/dang-ky">Đăng bài toán <ArrowRight className="size-4" /></Link></article>
          <article className="rounded-[2rem] bg-brand-navy p-7 text-white sm:p-9"><span className="grid size-12 place-items-center rounded-2xl bg-white/10 text-brand-light"><Users /></span><h2 className="mt-6 text-2xl font-bold">Dành cho sinh viên</h2><p className="mt-3 leading-7 text-white/70">Ứng dụng năng lực vào bài toán thật, xây dựng hồ sơ nhóm và học cách hợp tác với doanh nghiệp.</p><Link className="mt-6 inline-flex items-center gap-2 font-semibold text-brand-light" href="/dang-ky">Khám phá cơ hội <ArrowRight className="size-4" /></Link></article>
        </div>
      </section>

      <section className="rounded-[2rem] bg-card px-4 py-20 sm:px-6 lg:px-8" id="quy-trinh">
        <div className="mx-auto max-w-7xl"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Từ bài toán đến giá trị</p><h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">Một nền tảng, một quy trình rõ ràng.</h2><div className="mt-10 grid gap-0 md:grid-cols-2 lg:grid-cols-4">{processSteps.map(([number, title, description]) => <div className="border-t border-border px-4 py-5 first:pl-0 lg:nth-[4n+1]:pl-0" key={number}><span className="text-sm font-bold text-primary">{number}</span><h3 className="mt-3 font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p></div>)}</div></div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8" id="faq">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Câu hỏi thường gặp</p><h2 className="mt-3 text-3xl font-bold tracking-tight">Bạn muốn biết thêm?</h2>
        <div className="mt-8 divide-y divide-border rounded-2xl border border-border bg-card">
          {["UniBridge hoạt động như thế nào?", "Sinh viên tham gia ra sao?", "Bản thử nghiệm (Prototype) khác Triển khai có phí thế nào?", "Thanh toán và quyền sở hữu sản phẩm ra sao?"].map((question) => <details className="group p-5" key={question}><summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold"><span>{question}</span><ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" /></summary><p className="mt-3 pr-8 text-sm leading-6 text-muted-foreground">Hai bên xem thông tin minh bạch, thống nhất phạm vi và đầu ra theo từng giai đoạn. Các khoản phí và quyền sở hữu được thực hiện theo thỏa thuận giữa hai bên.</p></details>)}
        </div>
      </section>

      <footer className="bg-brand-navy px-4 py-12 text-white sm:px-6 lg:px-8"><div className="mx-auto flex max-w-7xl flex-col gap-8 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xl font-bold">UNIBRIDGE</p><p className="mt-2 text-sm text-white/60">Connect Ideas. Create Impact.</p></div><div className="flex flex-wrap gap-5 text-sm text-white/70"><Link href="#quy-trinh" className="hover:text-white">Quy trình</Link><Link href="/dang-nhap" className="hover:text-white">Đăng nhập</Link><Link href="/dang-ky" className="hover:text-white">Đăng ký</Link></div></div></footer>
    </main>
  );
}

async function HomeActions() {
  await connection();
  const session = await auth();
  if (session?.user) return <Link className="min-h-10 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90" href={getRoleHome(session.user.role)}>Vào dashboard</Link>;
  return <Link className="min-h-10 rounded-xl px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground" href="/dang-nhap">Đăng nhập</Link>;
}
